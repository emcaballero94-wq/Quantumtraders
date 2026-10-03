import { NextResponse } from 'next/server'
import { rejectIfRateLimited } from '@/lib/server/endpoint-guards'
import { withApiCache } from '@/lib/server/api-cache'
import { fetchMarketHistory, fetchMarketQuotes } from '@/lib/market-data'
import { riskRegimeFromVix } from '@/lib/oracle/risk-regime'
import { evaluateConditions } from '@/lib/scanner/conditions'
import { getLatestOrderFlowBrief } from '@/lib/oracle/orderflow-persistence'
import { listMarketEventsSince } from '@/lib/oracle/market-events-persistence'
import { listGexBriefs } from '@/lib/manu-gex/brief-persistence'
import { listOptionsFlowBriefs } from '@/lib/manu-options-flow/brief-persistence'
import { listTradeJournalEntries } from '@/lib/oracle/persistence'
import type { StationLive } from '@/lib/quantum-city/types'

// Quantum City's read-only state aggregator (Phase 2).
//
// This route NEVER triggers new engine computation that costs money — no
// Anthropic calls, no fresh brief generation. It only reads what each real
// engine has already persisted (or, for Scanner, re-evaluates the exact same
// deterministic condition-screener function the real Scanner page calls,
// against the same 60s-cached candle fetch it already uses — zero AI cost,
// zero duplicated logic). See docs/quantum-city-architecture.md §11.
//
// Atlas, Nexus, and Mind have no meaningful server-side "state" to read (no
// persisted signal distinct from their own page UI) and are intentionally
// left out of this response — the client keeps showing them as static IDLE
// until a future phase gives them one. Faking a status for them would
// violate the brief's own §0/§37 rule.

const ORDERFLOW_SYMBOL = 'BTCUSDT'
const ORDERFLOW_ACTIVE_WINDOW_MS = 90_000
const ORDERFLOW_ALERT_WINDOW_MS = 15 * 60_000
const BRIEF_FRESH_WINDOW_MS = 24 * 60 * 60_000

async function orderFlowState(): Promise<StationLive> {
  const [latest, recentEvents] = await Promise.all([
    getLatestOrderFlowBrief(ORDERFLOW_SYMBOL),
    listMarketEventsSince(ORDERFLOW_SYMBOL, new Date(Date.now() - ORDERFLOW_ALERT_WINDOW_MS).toISOString()),
  ])

  const hasHighSeverity = recentEvents.some((e) => e.severity === 'HIGH' || e.severity === 'CRITICAL')
  const ageMs = latest ? Date.now() - new Date(latest.createdAt).getTime() : null

  if (hasHighSeverity) {
    return { state: 'alert', detail: `${recentEvents.length} evento(s) de alta severidad en 15min`, lastUpdated: latest?.createdAt ?? null }
  }
  if (latest && ageMs !== null && ageMs < ORDERFLOW_ACTIVE_WINDOW_MS) {
    return { state: 'active', detail: `${ORDERFLOW_SYMBOL} · $${latest.price?.toFixed(0) ?? '—'}`, lastUpdated: latest.createdAt }
  }
  return { state: 'idle', detail: latest ? 'Sin brief reciente (página cerrada)' : 'Sin datos todavía', lastUpdated: latest?.createdAt ?? null }
}

async function gexState(): Promise<StationLive> {
  const [latest] = await listGexBriefs('crypto', 'BTC', 1)
  if (!latest) return { state: 'idle', detail: 'Sin brief todavía', lastUpdated: null }

  const ageMs = Date.now() - new Date(latest.createdAt).getTime()
  if (latest.status === 'REGIME_SHIFT') {
    return { state: 'alert', detail: `BTC · cambio de régimen gamma`, lastUpdated: latest.createdAt }
  }
  if (ageMs < BRIEF_FRESH_WINDOW_MS) {
    return { state: 'active', detail: `BTC · ${latest.status}`, lastUpdated: latest.createdAt }
  }
  return { state: 'idle', detail: `Último brief hace ${Math.round(ageMs / 3_600_000)}h`, lastUpdated: latest.createdAt }
}

async function optionsFlowState(): Promise<StationLive> {
  const [latest] = await listOptionsFlowBriefs('BTC', 1)
  if (!latest) return { state: 'idle', detail: 'Sin brief todavía', lastUpdated: null }

  const ageMs = Date.now() - new Date(latest.createdAt).getTime()
  if (ageMs < BRIEF_FRESH_WINDOW_MS) {
    return { state: 'active', detail: `BTC · lean ${latest.lean}`, lastUpdated: latest.createdAt }
  }
  return { state: 'idle', detail: `Último brief hace ${Math.round(ageMs / 3_600_000)}h`, lastUpdated: latest.createdAt }
}

async function journalState(): Promise<StationLive> {
  const entries = await listTradeJournalEntries(20)
  const today = new Date().toDateString()
  const todayCount = entries.filter((e) => new Date(e.createdAt).toDateString() === today).length

  return {
    state: todayCount > 0 ? 'active' : 'idle',
    detail: todayCount > 0 ? `${todayCount} operación(es) hoy` : 'Sin operaciones hoy',
    lastUpdated: entries[0]?.createdAt ?? null,
  }
}

async function macroState(): Promise<StationLive> {
  try {
    const quotes = await fetchMarketQuotes(['VIX'])
    const vix = quotes[0]?.price ?? null
    const regime = riskRegimeFromVix(vix)
    if (vix === null) return { state: 'idle', detail: 'Sin dato de VIX', lastUpdated: null }
    return {
      state: regime.label === 'Risk-Off' ? 'alert' : 'active',
      detail: `VIX ${vix.toFixed(1)} · ${regime.label}`,
      lastUpdated: new Date().toISOString(),
    }
  } catch {
    return { state: 'idle', detail: 'Sin dato de VIX', lastUpdated: null }
  }
}

async function scannerState(): Promise<StationLive> {
  try {
    const candles = await withApiCache('scanner:BTCUSD:1h:1mo', 60_000, () => fetchMarketHistory('BTCUSD', { interval: '1h', range: '1mo' }))
    if (candles.length < 30) return { state: 'idle', detail: 'Historial insuficiente', lastUpdated: null }

    const evaluation = evaluateConditions(candles)
    const primary = evaluation.matches[0] ?? null
    return {
      state: primary ? 'active' : 'idle',
      detail: primary ? `BTCUSD · ${primary.condition}` : 'Sin señales en BTCUSD (H1)',
      lastUpdated: new Date().toISOString(),
    }
  } catch {
    return { state: 'idle', detail: 'Sin datos todavía', lastUpdated: null }
  }
}

export async function GET(request: Request) {
  const blocked = rejectIfRateLimited(request, { routeKey: 'quantum-city-state', limit: 30, windowMs: 60_000 })
  if (blocked) return blocked

  const [orderflow, gex, options, tools, pulse, scanner] = await Promise.all([
    orderFlowState(),
    gexState(),
    optionsFlowState(),
    journalState(),
    macroState(),
    scannerState(),
  ])

  const wired = { orderflow, gex, options, tools, pulse, scanner }
  const values = Object.values(wired)
  const mando: StationLive = {
    state: values.some((s) => s.state === 'alert') ? 'alert' : values.some((s) => s.state === 'active') ? 'active' : 'idle',
    detail: `${values.filter((s) => s.state !== 'idle').length}/${values.length} motores con actividad reciente`,
    lastUpdated: new Date().toISOString(),
  }

  return NextResponse.json({
    success: true,
    data: {
      generatedAt: new Date().toISOString(),
      stations: { ...wired, mando },
    },
  })
}
