import type { KeyStrike, OptionTrade, StrikeConcentrationLevel } from './types'

export function computeStrikeConcentration(trades: OptionTrade[]): StrikeConcentrationLevel[] {
  const byStrike = new Map<number, StrikeConcentrationLevel>()

  for (const trade of trades) {
    const existing = byStrike.get(trade.strike) ?? {
      strike: trade.strike,
      callPremium: 0,
      putPremium: 0,
      callContracts: 0,
      putContracts: 0,
      callVolumeTrades: 0,
      putVolumeTrades: 0,
      callOpenInterest: null,
      putOpenInterest: null,
      netDirectionalPressure: 0,
    }

    const premium = trade.premium ?? 0
    if (trade.optionType === 'CALL') {
      existing.callPremium += premium
      existing.callContracts += trade.contracts
      existing.callVolumeTrades += 1
      if (trade.openInterest !== null) existing.callOpenInterest = trade.openInterest
    } else {
      existing.putPremium += premium
      existing.putContracts += trade.contracts
      existing.putVolumeTrades += 1
      if (trade.openInterest !== null) existing.putOpenInterest = trade.openInterest
    }
    existing.netDirectionalPressure = existing.callPremium - existing.putPremium

    byStrike.set(trade.strike, existing)
  }

  return [...byStrike.values()].sort((a, b) => a.strike - b.strike)
}

// Deliberately not labeled "support"/"resistance" — see the spec this
// implements (section 7): that's a technical-analysis claim this engine
// hasn't earned. "Key strike" just means capital is concentrated there.
export function identifyKeyStrikes(levels: StrikeConcentrationLevel[], topN = 5): KeyStrike[] {
  const totalPremium = levels.reduce((sum, l) => sum + l.callPremium + l.putPremium, 0)
  if (totalPremium === 0) return []

  return [...levels]
    .sort((a, b) => b.callPremium + b.putPremium - (a.callPremium + a.putPremium))
    .slice(0, topN)
    .map((level) => ({
      strike: level.strike,
      level,
      shareOfTotalPremium: (level.callPremium + level.putPremium) / totalPremium,
    }))
}
