import { describe, expect, it } from 'vitest'
import { blackScholesGreeks, blackScholesPrice, solveImpliedVolatility } from './black-scholes'

// Reference case: S=100, K=100 (ATM), T=1y, r=0, q=0, sigma=20%.
// Textbook ATM approximation call ≈ put ≈ 0.4*sigma*sqrt(T)*S*2/sqrt(2*pi)
// ≈ 7.97 (classic Hull-style example), and put-call parity collapses to
// call = put exactly when r=q=0.
const ATM = { spot: 100, strike: 100, yearsToExpiry: 1, iv: 0.2, riskFreeRate: 0, dividendYield: 0 } as const

describe('blackScholesPrice', () => {
  it('matches the known ATM reference price', () => {
    const call = blackScholesPrice({ ...ATM, optionType: 'call' })
    const put = blackScholesPrice({ ...ATM, optionType: 'put' })
    expect(call).toBeCloseTo(7.9656, 3)
    expect(put).toBeCloseTo(7.9656, 3)
  })

  it('returns 0 for degenerate inputs instead of NaN', () => {
    expect(blackScholesPrice({ ...ATM, optionType: 'call', iv: 0 })).toBe(0)
    expect(blackScholesPrice({ ...ATM, optionType: 'call', yearsToExpiry: 0 })).toBe(0)
    expect(blackScholesPrice({ ...ATM, optionType: 'call', spot: 0 })).toBe(0)
  })
})

describe('blackScholesGreeks', () => {
  it('matches the known ATM gamma', () => {
    const { gamma } = blackScholesGreeks({ ...ATM, optionType: 'call' })
    // pdf(d1=0.1) / (100 * 0.2 * 1) ≈ 0.39695 / 20 ≈ 0.01985
    expect(gamma).toBeCloseTo(0.01985, 4)
  })

  it('gamma is identical for calls and puts at the same strike (standard BS property)', () => {
    const callGamma = blackScholesGreeks({ ...ATM, optionType: 'call' }).gamma
    const putGamma = blackScholesGreeks({ ...ATM, optionType: 'put' }).gamma
    expect(callGamma).toBeCloseTo(putGamma, 10)
  })

  it('call delta is near 0.5 at the money with no drift', () => {
    const { delta } = blackScholesGreeks({ ...ATM, optionType: 'call' })
    expect(delta).toBeGreaterThan(0.5)
    expect(delta).toBeLessThan(0.6)
  })

  it('returns all zeros for degenerate inputs', () => {
    const greeks = blackScholesGreeks({ ...ATM, optionType: 'call', iv: 0 })
    expect(greeks).toEqual({ delta: 0, gamma: 0, theta: 0, vega: 0, rho: 0 })
  })
})

describe('solveImpliedVolatility', () => {
  it('round-trips a price generated at a known volatility', () => {
    const price = blackScholesPrice({ ...ATM, optionType: 'call' })
    const solved = solveImpliedVolatility(price, { ...ATM, optionType: 'call' })
    expect(solved).not.toBeNull()
    expect(solved!).toBeCloseTo(0.2, 3)
  })

  it('round-trips for a deep OTM contract where vega is tiny (forces the bisection fallback)', () => {
    const deepOtm = { ...ATM, strike: 200, optionType: 'call' as const }
    const price = blackScholesPrice(deepOtm)
    const solved = solveImpliedVolatility(price, deepOtm)
    expect(solved).not.toBeNull()
    expect(solved!).toBeCloseTo(0.2, 2)
  })

  it('returns null for a price below intrinsic value (unreachable by any volatility)', () => {
    const itm = { ...ATM, strike: 50, optionType: 'call' as const }
    // Intrinsic value alone is spot - strike = 50; a quoted price below that
    // cannot be explained by Black-Scholes at any positive volatility.
    const solved = solveImpliedVolatility(10, itm)
    expect(solved).toBeNull()
  })

  it('returns null for non-positive inputs', () => {
    expect(solveImpliedVolatility(0, { ...ATM, optionType: 'call' })).toBeNull()
    expect(solveImpliedVolatility(-5, { ...ATM, optionType: 'call' })).toBeNull()
  })
})
