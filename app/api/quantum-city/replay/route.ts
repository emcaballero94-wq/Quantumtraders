import { NextResponse } from 'next/server'
import { rejectIfRateLimited } from '@/lib/server/endpoint-guards'
import { listMarketEventsBetween } from '@/lib/oracle/market-events-persistence'
import { listGexBriefsBetween } from '@/lib/manu-gex/brief-persistence'
import { listOptionsFlowBriefsBetween } from '@/lib/manu-options-flow/brief-persistence'
import { listTradeJournalEntriesBetween } from '@/lib/oracle/persistence'
import { listBriefOutcomesBetween } from '@/lib/manu-options-flow/outcome-persistence'
import type { CityEvent, CityEventSeverity } from '@/lib/quantum-city/types'

// Quantum City's historical replay (Phase 5) — same honesty rule as the
// live event bus (app/api/quantum-city/events): every row here is a REAL
// persisted record from that calendar day, nothing reconstructed or
// invented. Unlike the live feed's rolling 24h lookback, this takes an
// explicit `date` and queries the actual date range, since a day far enough
// in the past would otherwise fall outside any "most recent N" query once
// enough rows have accumulated since (see each *Between persistence
// function's comment).
//
// Scope: Journal (trades) and Review (outcome grading) are the two stations
// this phase is about, but GEX/Options Flow briefs and Order Flow's
// HIGH/CRITICAL events are included too — a trader replaying a day wants to
// see what the rest of the system was saying at the same time, the same way
// the live floor already cross-references them.

const ORDERFLOW_SYMBOL = 'BTCUSDT'
const MAX_EVENTS = 200

const SEVERITY_MAP: Record<string, CityEventSeverity> = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
}

function parseDateParam(raw: string | null): { fromIso: string; toIso: string; date: string } | null {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null
  const from = new Date(`${raw}T00:00:00.000Z`)
  if (Number.isNaN(from.getTime())) return null
  const to = new Date(from.getTime() + 24 * 60 * 60_000)
  return { fromIso: from.toISOString(), toIso: to.toISOString(), date: raw }
}

export async function GET(request: Request) {
  const blocked = rejectIfRateLimited(request, { routeKey: 'quantum-city-replay', limit: 30, windowMs: 60_000 })
  if (blocked) return blocked

  const { searchParams } = new URL(request.url)
  const parsed = parseDateParam(searchParams.get('date'))
  if (!parsed) {
    return NextResponse.json({ success: false, error: 'Missing or invalid required param: date (YYYY-MM-DD)' }, { status: 400 })
  }
  const { fromIso, toIso, date } = parsed

  const [marketEvents, gexBriefs, optionsBriefs, trades, outcomes] = await Promise.all([
    listMarketEventsBetween(ORDERFLOW_SYMBOL, fromIso, toIso, MAX_EVENTS),
    listGexBriefsBetween('crypto', 'BTC', fromIso, toIso, MAX_EVENTS),
    listOptionsFlowBriefsBetween('BTC', fromIso, toIso, MAX_EVENTS),
    listTradeJournalEntriesBetween(fromIso, toIso, MAX_EVENTS),
    listBriefOutcomesBetween('options_flow', 'BTC', fromIso, toIso, MAX_EVENTS),
  ])

  const events: CityEvent[] = [
    ...marketEvents.map((e) => ({
      id: `orderflow-${e.id}`,
      station: 'orderflow' as const,
      timestamp: e.createdAt,
      label: `${e.type.replace(/_/g, ' ')} — ${e.evidence}`,
      severity: SEVERITY_MAP[e.severity] ?? 'low',
    })),
    ...gexBriefs.map((b) => ({
      id: `gex-${b.id}`,
      station: 'gex' as const,
      timestamp: b.createdAt,
      label: `GEX brief · ${b.status}`,
      severity: (b.status === 'REGIME_SHIFT' ? 'high' : 'low') as CityEventSeverity,
    })),
    ...optionsBriefs.map((b) => ({
      id: `options-${b.id}`,
      station: 'options' as const,
      timestamp: b.createdAt,
      label: `Options Flow brief · lean ${b.lean}`,
      severity: 'low' as CityEventSeverity,
    })),
    ...trades.map((t) => ({
      id: `tools-${t.id}`,
      station: 'tools' as const,
      timestamp: t.createdAt,
      label: `${t.symbol} ${t.side} · ${t.result}`,
      severity: 'low' as CityEventSeverity,
    })),
    ...outcomes.map((o) => ({
      id: `review-${o.id}`,
      station: 'review' as const,
      timestamp: o.recordedAt,
      label: `Outcome evaluado · lean ${o.lean} → ${o.correct ? 'correcto' : 'incorrecto'} (${o.priceChangePct.toFixed(2)}%)`,
      severity: (o.correct ? 'low' : 'medium') as CityEventSeverity,
    })),
  ].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

  return NextResponse.json({
    success: true,
    data: {
      date,
      events,
      tradesCount: trades.length,
      outcomesCount: outcomes.length,
    },
  })
}
