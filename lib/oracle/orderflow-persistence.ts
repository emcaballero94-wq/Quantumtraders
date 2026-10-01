import { createAdminClient } from '@/lib/supabase/admin'

export interface OrderFlowBriefRecord {
  id: string
  symbol: string
  briefText: string
  price: number | null
  cvd: number | null
  fundingRate: number | null
  openInterest: number | null
  bookImbalance: number | null
  liquidationLongNotional: number | null
  liquidationShortNotional: number | null
  /**
   * CVD is a client-side accumulator that resets to 0 whenever the Order
   * Flow page (re)loads or the symbol changes — it is NOT a homogeneous
   * series across sessions. This marks which session `cvd` belongs to, so a
   * delta should only ever be computed between two records that share the
   * same (non-null) value here. Null means "unknown session" (row predates
   * this column, or the client didn't report one) — always treat as
   * incomparable, never as a match.
   */
  cvdSessionStartedAt: string | null
  /** Same idea as cvdSessionStartedAt, but for the liquidations feed's running totals. */
  liquidationsSessionStartedAt: string | null
  createdAt: string
}

interface OrderFlowBriefRow {
  id: string
  symbol: string
  brief_text: string
  price: number | null
  cvd: number | null
  funding_rate: number | null
  open_interest: number | null
  book_imbalance: number | null
  liquidation_long_notional: number | null
  liquidation_short_notional: number | null
  cvd_session_started_at: string | null
  liquidations_session_started_at: string | null
  created_at: string
}

const SELECT_COLUMNS =
  'id, symbol, brief_text, price, cvd, funding_rate, open_interest, book_imbalance, liquidation_long_notional, liquidation_short_notional, cvd_session_started_at, liquidations_session_started_at, created_at'

function mapRow(row: OrderFlowBriefRow): OrderFlowBriefRecord {
  return {
    id: row.id,
    symbol: row.symbol,
    briefText: row.brief_text,
    price: row.price,
    cvd: row.cvd,
    fundingRate: row.funding_rate,
    openInterest: row.open_interest,
    bookImbalance: row.book_imbalance,
    liquidationLongNotional: row.liquidation_long_notional,
    liquidationShortNotional: row.liquidation_short_notional,
    cvdSessionStartedAt: row.cvd_session_started_at,
    liquidationsSessionStartedAt: row.liquidations_session_started_at,
    createdAt: row.created_at,
  }
}

// Fire-and-forget from the caller's perspective — never throws. Persistence
// is a nice-to-have for the backtest feature, not something that should ever
// break the brief the trader is looking at right now.
export async function insertOrderFlowBrief(input: {
  symbol: string
  briefText: string
  price: number | null
  cvd: number | null
  fundingRate: number | null
  openInterest: number | null
  bookImbalance: number | null
  liquidationLongNotional: number | null
  liquidationShortNotional: number | null
  cvdSessionStartedAt?: string | null
  liquidationsSessionStartedAt?: string | null
  snapshot: unknown
}): Promise<void> {
  const admin = createAdminClient()
  if (!admin) return

  try {
    await admin.from('orderflow_briefs').insert({
      symbol: input.symbol,
      brief_text: input.briefText,
      price: input.price,
      cvd: input.cvd,
      funding_rate: input.fundingRate,
      open_interest: input.openInterest,
      book_imbalance: input.bookImbalance,
      liquidation_long_notional: input.liquidationLongNotional,
      liquidation_short_notional: input.liquidationShortNotional,
      cvd_session_started_at: input.cvdSessionStartedAt ?? null,
      liquidations_session_started_at: input.liquidationsSessionStartedAt ?? null,
      snapshot: input.snapshot,
    })
  } catch (error) {
    console.error('[insertOrderFlowBrief] Error:', error)
  }
}

export async function listOrderFlowBriefs(symbol: string, limit = 500): Promise<OrderFlowBriefRecord[]> {
  const admin = createAdminClient()
  if (!admin) return []

  const { data, error } = await admin
    .from('orderflow_briefs')
    .select(SELECT_COLUMNS)
    .eq('symbol', symbol)
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error || !data) return []
  return (data as OrderFlowBriefRow[]).map(mapRow)
}

export async function listOrderFlowBriefsSince(symbol: string, sinceIso: string, limit = 500): Promise<OrderFlowBriefRecord[]> {
  const admin = createAdminClient()
  if (!admin) return []

  const { data, error } = await admin
    .from('orderflow_briefs')
    .select(SELECT_COLUMNS)
    .eq('symbol', symbol)
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error || !data) return []
  return (data as OrderFlowBriefRow[]).map(mapRow)
}
