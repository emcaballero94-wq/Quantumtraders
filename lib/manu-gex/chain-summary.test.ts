import { describe, it, expect } from 'vitest'
import { summarizeChain } from './chain-summary'

describe('summarizeChain', () => {
  it('computes put/call ratios and average IVs separately per side', () => {
    const summary = summarizeChain([
      { optionType: 'call', volume: 100, openInterest: 1000, iv: 0.2 },
      { optionType: 'call', volume: 50, openInterest: 500, iv: 0.3 },
      { optionType: 'put', volume: 300, openInterest: 2000, iv: 0.4 },
    ])

    expect(summary.totalVolume).toBe(450)
    expect(summary.totalOpenInterest).toBe(3500)
    expect(summary.putCallVolumeRatio).toBeCloseTo(300 / 150, 6)
    expect(summary.putCallOpenInterestRatio).toBeCloseTo(2000 / 1500, 6)
    expect(summary.avgCallIv).toBeCloseTo(0.25, 6)
    expect(summary.avgPutIv).toBeCloseTo(0.4, 6)
    expect(summary.ivSkew).toBeCloseTo(0.15, 6)
  })

  it('treats null/zero volume and OI as zero without throwing', () => {
    const summary = summarizeChain([
      { optionType: 'call', volume: null, openInterest: null, iv: null },
      { optionType: 'put', volume: null, openInterest: null, iv: null },
    ])

    expect(summary.totalVolume).toBe(0)
    expect(summary.totalOpenInterest).toBe(0)
    expect(summary.putCallVolumeRatio).toBeNull()
    expect(summary.putCallOpenInterestRatio).toBeNull()
    expect(summary.avgCallIv).toBeNull()
    expect(summary.avgPutIv).toBeNull()
    expect(summary.ivSkew).toBeNull()
  })

  it('returns null put/call ratio when the call side has no volume or OI (avoids divide by zero)', () => {
    const summary = summarizeChain([{ optionType: 'put', volume: 10, openInterest: 20, iv: 0.5 }])

    expect(summary.putCallVolumeRatio).toBeNull()
    expect(summary.putCallOpenInterestRatio).toBeNull()
  })

  it('ignores non-positive IV readings when averaging', () => {
    const summary = summarizeChain([
      { optionType: 'call', volume: 1, openInterest: 1, iv: 0 },
      { optionType: 'call', volume: 1, openInterest: 1, iv: 0.2 },
    ])

    expect(summary.avgCallIv).toBeCloseTo(0.2, 6)
  })
})
