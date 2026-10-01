import { describe, expect, it } from 'vitest'
import { deriveConfidence, deriveStatus, keyChangeText, riskFactors, buildDeterministicNarrative } from './brief-formatter'
import type { HistoricalPatternMatch, MarketEvent, MarketState, RelationshipObservation } from './types'

function event(overrides: Partial<MarketEvent>): MarketEvent {
  return {
    type: 'PRICE_ACCELERATION',
    timestamp: '2026-01-01T00:00:00Z',
    severity: 'LOW',
    asset: 'BTCUSDT',
    evidence: 'test',
    values: {},
    previousValues: {},
    ...overrides,
  }
}

function state(overrides: Partial<MarketState>): MarketState {
  return {
    asset: 'BTCUSDT',
    timestamp: '2026-01-01T00:00:00Z',
    price: 100,
    priceChange1m: null,
    priceChange5m: null,
    priceChange15m: null,
    cvd: null,
    cvdDelta1m: null,
    cvdDelta5m: null,
    funding: null,
    fundingChange: null,
    openInterest: null,
    openInterestChange1m: null,
    openInterestChange5m: null,
    orderBookImbalance: null,
    bidDepth: null,
    askDepth: null,
    spread: null,
    liquidationNotional: null,
    liquidationLong: null,
    liquidationShort: null,
    marketRegime: 'UNKNOWN',
    dataQuality: 'GOOD',
    ...overrides,
  }
}

const horizonStats = { gradedCount: 0, positiveRatePct: null, meanReturnPct: null, medianReturnPct: null, maxFavorableExcursionPct: null, maxAdverseExcursionPct: null }

function historical(overrides: Partial<HistoricalPatternMatch>): HistoricalPatternMatch {
  return {
    sampleSize: 0,
    sampleLabel: 'INSUFFICIENT_SAMPLE',
    matchScore: 0.75,
    fingerprint: {},
    horizons: { '5m': horizonStats, '15m': horizonStats, '60m': horizonStats },
    ...overrides,
  }
}

describe('deriveStatus', () => {
  it('is STABLE with no events — this is what prevents repeating the same brief every cycle', () => {
    expect(deriveStatus([])).toBe('STABLE')
  })

  it('escalates with the highest-severity event present', () => {
    expect(deriveStatus([event({ severity: 'LOW' })])).toBe('DEVELOPING')
    expect(deriveStatus([event({ severity: 'MEDIUM' })])).toBe('DEVELOPING')
    expect(deriveStatus([event({ severity: 'HIGH' })])).toBe('ACTIVE')
    expect(deriveStatus([event({ severity: 'CRITICAL' })])).toBe('EVENT')
    expect(deriveStatus([event({ severity: 'LOW' }), event({ severity: 'CRITICAL' })])).toBe('EVENT')
  })
})

describe('keyChangeText', () => {
  it('says nothing changed when there are no events (duplicate-brief guard)', () => {
    expect(keyChangeText([])).toBe('No significant change detected.')
  })

  it('describes the top event when one exists', () => {
    const text = keyChangeText([event({ type: 'LIQUIDATION_SPIKE', severity: 'CRITICAL', evidence: '$300,000 liquidated.' })])
    expect(text).toContain('$300,000 liquidated.')
  })
})

describe('deriveConfidence', () => {
  it('is LOW when data quality is insufficient, regardless of sample size', () => {
    const confidence = deriveConfidence(state({ dataQuality: 'INSUFFICIENT' }), historical({ sampleLabel: 'ROBUST_SAMPLE', sampleSize: 500 }), [])
    expect(confidence).toBe('LOW')
  })

  it('is HIGH only with good data, a robust sample, and at least one relationship', () => {
    const relationships: RelationshipObservation[] = [{ pair: 'PRICE+CVD', observation: 'demand confirmation', detail: '' }]
    const confidence = deriveConfidence(state({ dataQuality: 'GOOD' }), historical({ sampleLabel: 'ROBUST_SAMPLE', sampleSize: 500 }), relationships)
    expect(confidence).toBe('HIGH')
  })

  it('defaults to MEDIUM with good data but an insufficient historical sample', () => {
    const confidence = deriveConfidence(state({ dataQuality: 'GOOD' }), historical({}), [])
    expect(confidence).toBe('MEDIUM')
  })
})

describe('buildDeterministicNarrative', () => {
  const baseInput = {
    status: 'STABLE' as const,
    keyChange: 'No significant change detected.',
    state: state({}),
    events: [],
    relationships: [],
    historical: historical({}),
    confidence: 'MEDIUM' as const,
  }

  it('says there is no recent GEX brief when gexCrossContext is absent', () => {
    const text = buildDeterministicNarrative(baseInput)
    expect(text).toContain('OPCIONES (GEX)')
    expect(text).toContain('Sin brief de GEX reciente')
  })

  it('reports the cross-asset GEX facts when present', () => {
    const text = buildDeterministicNarrative({
      ...baseInput,
      gexCrossContext: { currency: 'BTC', ageSeconds: 600, regime: 'POSITIVE', netGex: 1_000_000, putCallVolumeRatio: 0.8, ivSkew: 0.05 },
    })
    expect(text).toContain('BTC hace 10min')
    expect(text).toContain('régimen positivo')
  })
})

describe('riskFactors', () => {
  it('flags an insufficient historical sample explicitly', () => {
    const factors = riskFactors(state({ dataQuality: 'GOOD' }), [], historical({ sampleLabel: 'INSUFFICIENT_SAMPLE', sampleSize: 5 }))
    expect(factors.some((f) => f.includes('n=5'))).toBe(true)
  })

  it('always returns at least one factor, even with clean data and a robust sample', () => {
    const factors = riskFactors(state({ dataQuality: 'GOOD' }), [], historical({ sampleLabel: 'ROBUST_SAMPLE', sampleSize: 500 }))
    expect(factors.length).toBeGreaterThan(0)
  })
})
