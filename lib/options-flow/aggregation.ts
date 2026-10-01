import type { DteBucket, DteBucketId, OptionTrade, PremiumTotals } from './types'
import { classifyTrades } from './classification'

export function aggregatePremium(trades: OptionTrade[]): PremiumTotals {
  let callPremium = 0
  let putPremium = 0
  let callContracts = 0
  let putContracts = 0
  let callVolumeTrades = 0
  let putVolumeTrades = 0

  for (const trade of trades) {
    const premium = trade.premium ?? 0
    if (trade.optionType === 'CALL') {
      callPremium += premium
      callContracts += trade.contracts
      callVolumeTrades += 1
    } else {
      putPremium += premium
      putContracts += trade.contracts
      putVolumeTrades += 1
    }
  }

  return {
    callPremium,
    putPremium,
    netPremium: callPremium - putPremium,
    callContracts,
    putContracts,
    callVolumeTrades,
    putVolumeTrades,
    callPutRatioByPremium: putPremium > 0 ? callPremium / putPremium : null,
    callPutRatioByContracts: putContracts > 0 ? callContracts / putContracts : null,
    callPutRatioByTradeCount: putVolumeTrades > 0 ? callVolumeTrades / putVolumeTrades : null,
  }
}

export interface DirectionalPremiumTotals {
  bullishPremium: number
  bearishPremium: number
  neutralPremium: number
  unknownPremium: number
  bullishTradeCount: number
  bearishTradeCount: number
}

// Unlike aggregatePremium (raw CALL/PUT split), this sums premium by the
// classified direction (lib/options-flow/classification.ts) — the basis for
// flow acceleration and the options pressure score, since CALL != bullish.
export function aggregateDirectionalPremium(trades: OptionTrade[]): DirectionalPremiumTotals {
  const classified = classifyTrades(trades)
  const totals: DirectionalPremiumTotals = {
    bullishPremium: 0,
    bearishPremium: 0,
    neutralPremium: 0,
    unknownPremium: 0,
    bullishTradeCount: 0,
    bearishTradeCount: 0,
  }

  for (const { trade, classification } of classified) {
    const premium = trade.premium ?? 0
    switch (classification.direction) {
      case 'BULLISH':
        totals.bullishPremium += premium
        totals.bullishTradeCount += 1
        break
      case 'BEARISH':
        totals.bearishPremium += premium
        totals.bearishTradeCount += 1
        break
      case 'NEUTRAL':
        totals.neutralPremium += premium
        break
      default:
        totals.unknownPremium += premium
    }
  }

  return totals
}

export function dteBucketId(dte: number): DteBucketId {
  if (dte <= 1) return '0-1'
  if (dte <= 7) return '2-7'
  if (dte <= 30) return '8-30'
  if (dte <= 60) return '31-60'
  return '60+'
}

const DTE_BUCKET_ORDER: DteBucketId[] = ['0-1', '2-7', '8-30', '31-60', '60+']

export function bucketByDte(trades: OptionTrade[]): DteBucket[] {
  const groups = new Map<DteBucketId, OptionTrade[]>()
  for (const trade of trades) {
    const id = dteBucketId(trade.dte)
    const bucket = groups.get(id) ?? []
    bucket.push(trade)
    groups.set(id, bucket)
  }

  return DTE_BUCKET_ORDER.filter((id) => groups.has(id)).map((id) => {
    const bucketTrades = groups.get(id) ?? []
    return { id, trades: bucketTrades, totals: aggregatePremium(bucketTrades) }
  })
}

export function filterByWindow(trades: OptionTrade[], endTimestamp: number, windowMinutes: number): OptionTrade[] {
  const start = endTimestamp - windowMinutes * 60_000
  return trades.filter((trade) => trade.timestamp > start && trade.timestamp <= endTimestamp)
}
