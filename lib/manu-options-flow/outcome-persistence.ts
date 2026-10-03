import { createAdminClient } from '@/lib/supabase/admin'
import type { ActualDirection } from './outcome-tracking'
import type { OptionsFlowLean } from './types'

export const OUTCOME_HORIZON_HOURS = 24

export interface BriefOutcomeRecord {
  id: string
  engine: string
  briefId: string
  symbol: string
  lean: OptionsFlowLean
  priceAtBrief: number
  briefCreatedAt: string
  horizonHours: number
  priceAtOutcome: number
  priceChangePct: number
  actualDirection: ActualDirection
  correct: boolean
  recordedAt: string
}

interface BriefOutcomeRow {
  id: string
  engine: string
  brief_id: string
  symbol: string
  lean: OptionsFlowLean
  price_at_brief: number
  brief_created_at: string
  horizon_hours: number
  price_at_outcome: number
  price_change_pct: number
  actual_direction: ActualDirection
  correct: boolean
  recorded_at: string
}

const SELECT_COLUMNS =
  'id, engine, brief_id, symbol, lean, price_at_brief, brief_created_at, horizon_hours, price_at_outcome, price_change_pct, actual_direction, correct, recorded_at'

function mapRow(row: BriefOutcomeRow): BriefOutcomeRecord {
  return {
    id: row.id,
    engine: row.engine,
    briefId: row.brief_id,
    symbol: row.symbol,
    lean: row.lean,
    priceAtBrief: row.price_at_brief,
    briefCreatedAt: row.brief_created_at,
    horizonHours: row.horizon_hours,
    priceAtOutcome: row.price_at_outcome,
    priceChangePct: row.price_change_pct,
    actualDirection: row.actual_direction,
    correct: row.correct,
    recordedAt: row.recorded_at,
  }
}

// Idempotent by design (unique on engine+brief_id, ignoreDuplicates) — the
// cron that calls this can safely re-run over the same brief more than once
// (retries, overlapping invocations) without double-counting it in the
// accuracy summary.
export async function insertBriefOutcome(input: {
  engine: string
  briefId: string
  symbol: string
  lean: OptionsFlowLean
  priceAtBrief: number
  briefCreatedAt: string
  horizonHours: number
  priceAtOutcome: number
  priceChangePct: number
  actualDirection: ActualDirection
  correct: boolean
}): Promise<void> {
  const admin = createAdminClient()
  if (!admin) return

  try {
    await admin
      .from('brief_outcomes')
      .upsert(
        {
          engine: input.engine,
          brief_id: input.briefId,
          symbol: input.symbol,
          lean: input.lean,
          price_at_brief: input.priceAtBrief,
          brief_created_at: input.briefCreatedAt,
          horizon_hours: input.horizonHours,
          price_at_outcome: input.priceAtOutcome,
          price_change_pct: input.priceChangePct,
          actual_direction: input.actualDirection,
          correct: input.correct,
        },
        { onConflict: 'engine,brief_id', ignoreDuplicates: true },
      )
  } catch (error) {
    console.error('[insertBriefOutcome] Error:', error)
  }
}

export async function listBriefOutcomes(engine: string, symbol: string, limit = 200): Promise<BriefOutcomeRecord[]> {
  const admin = createAdminClient()
  if (!admin) return []

  const { data, error } = await admin
    .from('brief_outcomes')
    .select(SELECT_COLUMNS)
    .eq('engine', engine)
    .eq('symbol', symbol)
    .order('recorded_at', { ascending: false })
    .limit(limit)

  if (error || !data) return []
  return (data as BriefOutcomeRow[]).map(mapRow)
}

// For Quantum City's historical replay (Phase 5) — a date range on
// `recorded_at` rather than "most recent N" so an old calendar day isn't
// silently dropped once enough outcomes have accumulated since.
export async function listBriefOutcomesBetween(engine: string, symbol: string, fromIso: string, toIso: string, limit = 500): Promise<BriefOutcomeRecord[]> {
  const admin = createAdminClient()
  if (!admin) return []

  const { data, error } = await admin
    .from('brief_outcomes')
    .select(SELECT_COLUMNS)
    .eq('engine', engine)
    .eq('symbol', symbol)
    .gte('recorded_at', fromIso)
    .lt('recorded_at', toIso)
    .order('recorded_at', { ascending: true })
    .limit(limit)

  if (error || !data) return []
  return (data as BriefOutcomeRow[]).map(mapRow)
}

export interface AccuracySummary {
  totalEvaluated: number
  correctCount: number
  /** 0-1, null when there's nothing evaluated yet. */
  accuracyRate: number | null
}

// Computed in JS over the recent rows rather than a SQL aggregate — at this
// volume (a handful of briefs a day) that's simpler than wiring an RPC, and
// easy to re-derive differently later (e.g. windowed by date) without a
// migration.
export async function computeAccuracySummary(engine: string, symbol: string): Promise<AccuracySummary> {
  const outcomes = await listBriefOutcomes(engine, symbol, 500)
  const totalEvaluated = outcomes.length
  const correctCount = outcomes.filter((o) => o.correct).length
  return {
    totalEvaluated,
    correctCount,
    accuracyRate: totalEvaluated > 0 ? correctCount / totalEvaluated : null,
  }
}
