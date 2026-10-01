import { describe, it, expect } from 'vitest'
import { deriveGexStatus, keyChangeText, buildDeterministicGexNarrative } from './narrative'
import type { GexBriefFacts } from './types'

function facts(overrides: Partial<GexBriefFacts> = {}): GexBriefFacts {
  return {
    assetClass: 'equity',
    symbol: 'SPY',
    underlyingPrice: 450,
    netGex: -1_000_000,
    regime: 'NEGATIVE',
    callWallStrike: 460,
    putWallStrike: 440,
    gammaFlip: 452,
    maxPainStrike: 450,
    contractsWithGamma: 80,
    totalContracts: 100,
    dataQuality: 'GOOD',
    chain: {
      totalVolume: 1000,
      totalOpenInterest: 5000,
      putCallVolumeRatio: 1.2,
      putCallOpenInterestRatio: 0.9,
      avgCallIv: 0.18,
      avgPutIv: 0.22,
      ivSkew: 0.04,
    },
    dayOverDay: null,
    ...overrides,
  }
}

describe('deriveGexStatus', () => {
  it('returns NO_HISTORY with no prior snapshot', () => {
    expect(deriveGexStatus(facts({ dayOverDay: null }))).toBe('NO_HISTORY')
  })

  it('returns REGIME_SHIFT when the regime flipped', () => {
    const f = facts({
      dayOverDay: {
        priorDate: '2026-09-30',
        priorNetGex: 1,
        priorCallWallStrike: null,
        priorPutWallStrike: null,
        priorGammaFlip: null,
        regimeShift: 'FLIPPED_TO_NEGATIVE',
        netGexChangePct: null,
        callWallDeltaStrikes: null,
        putWallDeltaStrikes: null,
      },
    })
    expect(deriveGexStatus(f)).toBe('REGIME_SHIFT')
  })

  it('returns STABLE when the regime held', () => {
    const f = facts({
      dayOverDay: {
        priorDate: '2026-09-30',
        priorNetGex: -1,
        priorCallWallStrike: null,
        priorPutWallStrike: null,
        priorGammaFlip: null,
        regimeShift: 'UNCHANGED_NEGATIVE',
        netGexChangePct: null,
        callWallDeltaStrikes: null,
        putWallDeltaStrikes: null,
      },
    })
    expect(deriveGexStatus(f)).toBe('STABLE')
  })
})

describe('keyChangeText', () => {
  it('says there is no prior snapshot when dayOverDay is null', () => {
    expect(keyChangeText(facts({ dayOverDay: null }))).toMatch(/primera lectura/)
  })
})

describe('buildDeterministicGexNarrative', () => {
  it('never throws and includes the regime section for an all-null-history brief', () => {
    const text = buildDeterministicGexNarrative(facts({ dayOverDay: null }))
    expect(text).toContain('RÉGIMEN')
    expect(text).toContain('Sin snapshot previo todavía.')
  })
})
