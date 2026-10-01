import type { OptionsChainSummary } from './types'

export interface ChainSummaryInput {
  optionType: 'call' | 'put'
  volume: number | null
  openInterest: number | null
  iv: number | null
}

// Plain volume/OI/IV aggregates across a chain — deliberately simple (no
// delta-weighting, no per-strike skew curve) since this only feeds a brief
// that states a ratio and a skew direction, not a trading model.
export function summarizeChain(contracts: ChainSummaryInput[]): OptionsChainSummary {
  let callVolume = 0
  let putVolume = 0
  let callOpenInterest = 0
  let putOpenInterest = 0
  let callIvSum = 0
  let callIvCount = 0
  let putIvSum = 0
  let putIvCount = 0

  for (const c of contracts) {
    const volume = c.volume ?? 0
    const openInterest = c.openInterest ?? 0
    if (c.optionType === 'call') {
      callVolume += volume
      callOpenInterest += openInterest
      if (c.iv !== null && Number.isFinite(c.iv) && c.iv > 0) {
        callIvSum += c.iv
        callIvCount += 1
      }
    } else {
      putVolume += volume
      putOpenInterest += openInterest
      if (c.iv !== null && Number.isFinite(c.iv) && c.iv > 0) {
        putIvSum += c.iv
        putIvCount += 1
      }
    }
  }

  const avgCallIv = callIvCount > 0 ? callIvSum / callIvCount : null
  const avgPutIv = putIvCount > 0 ? putIvSum / putIvCount : null

  return {
    totalVolume: callVolume + putVolume,
    totalOpenInterest: callOpenInterest + putOpenInterest,
    putCallVolumeRatio: callVolume > 0 ? putVolume / callVolume : null,
    putCallOpenInterestRatio: callOpenInterest > 0 ? putOpenInterest / callOpenInterest : null,
    avgCallIv,
    avgPutIv,
    ivSkew: avgCallIv !== null && avgPutIv !== null ? avgPutIv - avgCallIv : null,
  }
}
