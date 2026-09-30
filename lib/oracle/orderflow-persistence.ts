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
  created_at: string
}

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
    .select('id, symbol, brief_text, price, cvd, funding_rate, open_interest, book_imbalance, liquidation_long_notional, liquidation_short_notional, created_at')
    .eq('symbol', symbol)
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error || !data) return []
  return (data as OrderFlowBriefRow[]).map(mapRow)
}
