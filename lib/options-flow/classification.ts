import type { OptionTrade, TradeClassification } from './types'

// CALL != bullish and PUT != bearish on their own — per the spec this engine
// implements, that's too simplistic (a sold call is bearish-ish, a sold put
// is bullish-ish, and execution side matters more than option type). This
// infers who was the aggressor in the trade, then maps (type, aggressor) to
// a direction — falling back to weaker signals, and to UNKNOWN, when the
// data doesn't support a confident read.

type Aggressor = 'BUY_AGGRESSIVE' | 'SELL_AGGRESSIVE' | 'UNKNOWN'

function inferAggressor(trade: OptionTrade): { aggressor: Aggressor; fromExecutionSide: boolean; fromTradeSide: boolean } {
  const executionSaysBuy = trade.executionSide === 'AT_ASK'
  const executionSaysSell = trade.executionSide === 'AT_BID'
  const sideSaysBuy = trade.side === 'BUY'
  const sideSaysSell = trade.side === 'SELL'

  if (executionSaysBuy) return { aggressor: 'BUY_AGGRESSIVE', fromExecutionSide: true, fromTradeSide: sideSaysBuy }
  if (executionSaysSell) return { aggressor: 'SELL_AGGRESSIVE', fromExecutionSide: true, fromTradeSide: sideSaysSell }
  if (sideSaysBuy) return { aggressor: 'BUY_AGGRESSIVE', fromExecutionSide: false, fromTradeSide: true }
  if (sideSaysSell) return { aggressor: 'SELL_AGGRESSIVE', fromExecutionSide: false, fromTradeSide: true }
  return { aggressor: 'UNKNOWN', fromExecutionSide: false, fromTradeSide: false }
}

export function classifyTrade(trade: OptionTrade): TradeClassification {
  const { aggressor, fromExecutionSide, fromTradeSide } = inferAggressor(trade)

  if (aggressor === 'UNKNOWN') {
    return {
      direction: 'UNKNOWN',
      confidence: 'LOW',
      reason: 'insufficient execution-side data — no bid/ask execution classification and no trade side reported',
    }
  }

  const bothSignalsAgree = fromExecutionSide && fromTradeSide
  const confidence = bothSignalsAgree ? 'HIGH' : 'MEDIUM'

  if (trade.optionType === 'CALL') {
    return aggressor === 'BUY_AGGRESSIVE'
      ? { direction: 'BULLISH', confidence, reason: 'call bought aggressively (at/near ask)' }
      : { direction: 'BEARISH', confidence: bothSignalsAgree ? 'MEDIUM' : 'LOW', reason: 'call sold aggressively (at/near bid) — could also be covered-call writing' }
  }

  // PUT
  return aggressor === 'BUY_AGGRESSIVE'
    ? { direction: 'BEARISH', confidence, reason: 'put bought aggressively (at/near ask)' }
    : { direction: 'BULLISH', confidence: bothSignalsAgree ? 'MEDIUM' : 'LOW', reason: 'put sold aggressively (at/near bid) — could also be cash-secured-put writing' }
}

export interface ClassifiedTrade {
  trade: OptionTrade
  classification: TradeClassification
}

export function classifyTrades(trades: OptionTrade[]): ClassifiedTrade[] {
  return trades.map((trade) => ({ trade, classification: classifyTrade(trade) }))
}
