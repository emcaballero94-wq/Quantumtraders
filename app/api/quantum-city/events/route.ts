import { NextResponse } from 'next/server'
import { rejectIfRateLimited } from '@/lib/server/endpoint-guards'
import { listMarketEventsSince } from '@/lib/oracle/market-events-persistence'
import { listGexBriefs } from '@/lib/manu-gex/brief-persistence'
import { listOptionsFlowBriefs } from '@/lib/manu-options-flow/brief-persistence'
import { listTradeJournalEntries } from '@/lib/oracle/persistence'
import type { CityEvent, CityEventSeverity } from '@/lib/quantum-city/types'

// Quantum City's event bus (Phase 3) — a read-only MERGE of events that
// already exist across engines, sorted into one timeline. Nothing here is
// invented: every row traces back to a real persisted record (a market
// event, a brief, a trade). See docs/quantum-city-architecture.md §9 — there
// is no generic `agent_events` table in the schema, so this route is the
// merge layer instead of a new one, exactly like the state aggregator reuses
// existing reads rather than duplicating engine logic.

const LOOKBACK_MS = 24 * 60 * 60_000
const ORDERFLOW_SYMBOL = 'BTCUSDT'
const MAX_EVENTS = 25

const SEVERITY_MAP: Record<string, CityEventSeverity> = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
}

export async function GET(request: Request) {
  const blocked = rejectIfRateLimited(request, { routeKey: 'quantum-city-events', limit: 30, windowMs: 60_000 })
  if (blocked) return blocked

  const since = new Date(Date.now() - LOOKBACK_MS).toISOString()

  const [marketEvents, gexBriefs, optionsBriefs, trades] = await Promise.all([
    listMarketEventsSince(ORDERFLOW_SYMBOL, since, 50),
    listGexBriefs('crypto', 'BTC', 8),
    listOptionsFlowBriefs('BTC', 8),
    listTradeJournalEntries(10),
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
  ]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, MAX_EVENTS)

  return NextResponse.json({ success: true, data: { events } })
}
