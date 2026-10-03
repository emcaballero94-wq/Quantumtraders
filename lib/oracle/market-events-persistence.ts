import { createAdminClient } from '@/lib/supabase/admin'
import type { MarketEvent, Severity } from '@/lib/manu/types'

// Only HIGH/CRITICAL events are persisted (see app/api/manu/analyze/route.ts)
// — this table is meant for reconstructing "what were the big moments today",
// not a full audit log of every LOW-severity classification.
export async function insertMarketEvents(events: MarketEvent[]): Promise<void> {
  if (events.length === 0) return
  const admin = createAdminClient()
  if (!admin) return

  try {
    await admin.from('market_events').insert(
      events.map((e) => ({
        symbol: e.asset,
        type: e.type,
        severity: e.severity,
        evidence: e.evidence,
        values: e.values,
        previous_values: e.previousValues,
        created_at: e.timestamp,
      })),
    )
  } catch (error) {
    console.error('[insertMarketEvents] Error:', error)
  }
}

export interface MarketEventRecord {
  id: string
  symbol: string
  type: string
  severity: Severity
  evidence: string
  values: Record<string, unknown>
  previousValues: Record<string, unknown>
  createdAt: string
}

interface MarketEventRow {
  id: string
  symbol: string
  type: string
  severity: string
  evidence: string
  values: Record<string, unknown>
  previous_values: Record<string, unknown>
  created_at: string
}

function mapRow(row: MarketEventRow): MarketEventRecord {
  return {
    id: row.id,
    symbol: row.symbol,
    type: row.type,
    severity: row.severity as Severity,
    evidence: row.evidence,
    values: row.values,
    previousValues: row.previous_values,
    createdAt: row.created_at,
  }
}

export async function listMarketEventsSince(symbol: string, sinceIso: string, limit = 500): Promise<MarketEventRecord[]> {
  const admin = createAdminClient()
  if (!admin) return []

  const { data, error } = await admin
    .from('market_events')
    .select('id, symbol, type, severity, evidence, values, previous_values, created_at')
    .eq('symbol', symbol)
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error || !data) return []
  return (data as MarketEventRow[]).map(mapRow)
}

// For Quantum City's historical replay (Phase 5) — a bounded window instead
// of an open-ended "since", so a past calendar day's query doesn't also pull
// in everything between that day and now.
export async function listMarketEventsBetween(symbol: string, fromIso: string, toIso: string, limit = 500): Promise<MarketEventRecord[]> {
  const admin = createAdminClient()
  if (!admin) return []

  const { data, error } = await admin
    .from('market_events')
    .select('id, symbol, type, severity, evidence, values, previous_values, created_at')
    .eq('symbol', symbol)
    .gte('created_at', fromIso)
    .lt('created_at', toIso)
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error || !data) return []
  return (data as MarketEventRow[]).map(mapRow)
}
