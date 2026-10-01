import { describe, expect, it } from 'vitest'
import { computeGex, resolveGamma, type GexContract } from './compute'
import { blackScholesGreeks, blackScholesPrice } from './black-scholes'

function contract(overrides: Partial<GexContract>): GexContract {
  return {
    strike: 100,
    optionType: 'call',
    openInterest: 0,
    gamma: null,
    iv: null,
    last: null,
    ...overrides,
  }
}

describe('resolveGamma', () => {
  it('prefers the source-reported gamma over solving one', () => {
    const gamma = resolveGamma({
      contract: contract({ gamma: 0.05, iv: 0.9, last: 1000 }), // iv/last would give a very different answer
      spot: 100,
      yearsToExpiry: 1,
    })
    expect(gamma).toBe(0.05)
  })

  it('falls back to the reported IV when gamma is missing', () => {
    const expected = blackScholesGreeks({
      spot: 100,
      strike: 100,
      yearsToExpiry: 1,
      iv: 0.25,
      riskFreeRate: 0.045,
      dividendYield: 0,
      optionType: 'call',
    }).gamma

    const gamma = resolveGamma({
      contract: contract({ gamma: null, iv: 0.25 }),
      spot: 100,
      yearsToExpiry: 1,
    })
    expect(gamma).toBeCloseTo(expected, 10)
  })

  it('solves IV from the last price when neither gamma nor IV is available', () => {
    const price = blackScholesPrice({
      spot: 100,
      strike: 100,
      yearsToExpiry: 1,
      iv: 0.3,
      riskFreeRate: 0.045,
      dividendYield: 0,
      optionType: 'call',
    })
    const gamma = resolveGamma({
      contract: contract({ gamma: null, iv: null, last: price }),
      spot: 100,
      yearsToExpiry: 1,
    })
    expect(gamma).not.toBeNull()
    expect(gamma!).toBeGreaterThan(0)
  })

  it('returns null when there is nothing to price from (ausencia de datos)', () => {
    expect(resolveGamma({ contract: contract({}), spot: 100, yearsToExpiry: 1 })).toBeNull()
  })
})

describe('computeGex', () => {
  it('puts contribute negative GEX, calls positive, by construction', () => {
    const contracts: GexContract[] = [
      contract({ strike: 100, optionType: 'call', openInterest: 1000, gamma: 0.02 }),
      contract({ strike: 100, optionType: 'put', openInterest: 1000, gamma: 0.02 }),
    ]
    const result = computeGex(contracts, 100, 0.25)
    const [point] = result.profile
    expect(point.callGex).toBeGreaterThan(0)
    expect(point.putGex).toBeLessThan(0)
    // Same gamma and OI on both sides at the same strike cancels out exactly.
    expect(point.netGex).toBeCloseTo(0, 6)
  })

  it('identifies the call wall and put wall as the strikes with the largest one-sided exposure', () => {
    const contracts: GexContract[] = [
      contract({ strike: 95, optionType: 'put', openInterest: 500, gamma: 0.01 }),
      contract({ strike: 100, optionType: 'put', openInterest: 5000, gamma: 0.02 }), // largest put wall
      contract({ strike: 105, optionType: 'call', openInterest: 500, gamma: 0.01 }),
      contract({ strike: 110, optionType: 'call', openInterest: 8000, gamma: 0.015 }), // largest call wall
    ]
    const result = computeGex(contracts, 100, 0.25)
    expect(result.callWallStrike).toBe(110)
    expect(result.putWallStrike).toBe(100)
  })

  it('skips strikes with no usable gamma without crashing, and reports how many were skipped', () => {
    const contracts: GexContract[] = [
      contract({ strike: 100, optionType: 'call', openInterest: 100, gamma: 0.02 }),
      contract({ strike: 105, optionType: 'call', openInterest: 100, gamma: null, iv: null, last: null }),
    ]
    const result = computeGex(contracts, 100, 0.25)
    expect(result.contractsWithGamma).toBe(1)
    expect(result.totalContracts).toBe(2)
  })

  it('finds max pain at the strike with the smallest total payout to holders', () => {
    // Single call and single put, same strike, same OI — payout to either
    // side is zero exactly at that strike (both expire worthless), the
    // unambiguous minimum.
    const contracts: GexContract[] = [
      contract({ strike: 100, optionType: 'call', openInterest: 1000, gamma: 0.01 }),
      contract({ strike: 100, optionType: 'put', openInterest: 1000, gamma: 0.01 }),
    ]
    const result = computeGex(contracts, 100, 0.25)
    expect(result.maxPainStrike).toBe(100)
  })

  it('reports no max pain when there is no open interest anywhere (ausencia de datos)', () => {
    const contracts: GexContract[] = [
      contract({ strike: 100, optionType: 'call', openInterest: 0, gamma: 0.01 }),
      contract({ strike: 105, optionType: 'put', openInterest: 0, gamma: 0.01 }),
    ]
    const result = computeGex(contracts, 100, 0.25)
    expect(result.maxPainStrike).toBeNull()
  })

  it('finds the gamma flip crossing nearest the spot price, not the first or deepest one', () => {
    // Using gamma=0.0001 with spot=100 makes each contract's GEX contribution
    // equal to its open interest (0.0001 * OI * 100 * 100 = OI), so the netGex
    // by strike is exactly [-3, +5, -10, +20] — cumulative [-3, +2, -8, +12],
    // which crosses zero three times: ~56 (50→60), ~67 (60→95), and ~99
    // (95→105). Only the one nearest spot=100 should be returned.
    const gamma = 0.0001
    const contracts: GexContract[] = [
      contract({ strike: 50, optionType: 'put', openInterest: 3, gamma }),
      contract({ strike: 60, optionType: 'call', openInterest: 5, gamma }),
      contract({ strike: 95, optionType: 'put', openInterest: 10, gamma }),
      contract({ strike: 105, optionType: 'call', openInterest: 20, gamma }),
    ]
    const result = computeGex(contracts, 100, 0.25)
    expect(result.gammaFlip).not.toBeNull()
    expect(result.gammaFlip!).toBeGreaterThan(90)
    expect(result.gammaFlip!).toBeLessThan(110)
  })

  it('does not report a false crossing where the profile is simply flat at zero', () => {
    // Only one strike carries any exposure — everything else is exactly
    // zero, which must never be read as a sign change.
    const contracts: GexContract[] = [contract({ strike: 100, optionType: 'call', openInterest: 1000, gamma: 0.02 })]
    const result = computeGex(contracts, 100, 0.25)
    expect(result.gammaFlip).toBeNull()
  })
})
