import { describe, expect, it } from 'vitest'
import { deriveOptionsFlowLean, keyChangeText, buildDeterministicOptionsFlowNarrative } from './narrative'
import type { OptionsFlowBriefFacts } from './types'

function makeFacts(overrides: Partial<OptionsFlowBriefFacts> = {}): OptionsFlowBriefFacts {
  return {
    currency: 'BTC',
    tradeCount: 500,
    score: 50,
    scoreConfidence: 'HIGH',
    dataQuality: 'GOOD',
    bullishPremium: 1_000_000,
    bearishPremium: 1_000_000,
    callPremium: 1_500_000,
    putPremium: 500_000,
    callPutRatio: 3,
    acceleration: null,
    largeTradeCount: 0,
    topLargeTrades: [],
    keyStrikes: [],
    ...overrides,
  }
}

describe('deriveOptionsFlowLean', () => {
  it('reports BULLISH at or above the 60 threshold', () => {
    expect(deriveOptionsFlowLean(makeFacts({ score: 60 }))).toBe('BULLISH')
  })

  it('reports BEARISH at or below the 40 threshold', () => {
    expect(deriveOptionsFlowLean(makeFacts({ score: 40 }))).toBe('BEARISH')
  })

  it('reports NEUTRAL in between', () => {
    expect(deriveOptionsFlowLean(makeFacts({ score: 50 }))).toBe('NEUTRAL')
  })
})

describe('keyChangeText', () => {
  it('includes the score and the derived lean in Spanish', () => {
    const text = keyChangeText(makeFacts({ score: 72, scoreConfidence: 'MEDIUM' }))
    expect(text).toContain('72/100')
    expect(text).toContain('alcista')
    expect(text).toContain('MEDIUM')
  })
})

describe('buildDeterministicOptionsFlowNarrative', () => {
  it('includes all six fixed section headers', () => {
    const narrative = buildDeterministicOptionsFlowNarrative(makeFacts())
    for (const header of ['PRESIÓN', 'OPERACIONES GRANDES', 'STRIKES CLAVE', 'ACELERACIÓN', 'INTERPRETACIÓN', 'RIESGO']) {
      expect(narrative).toContain(header)
    }
  })

  it('falls back to literal no-data text when there are no large trades or key strikes', () => {
    const narrative = buildDeterministicOptionsFlowNarrative(makeFacts({ largeTradeCount: 0, keyStrikes: [] }))
    expect(narrative).toContain('Sin operaciones grandes detectadas')
    expect(narrative).toContain('Sin concentración relevante por strike')
  })

  it('never claims combo/spread detection — always flags the single-leg limitation', () => {
    const narrative = buildDeterministicOptionsFlowNarrative(makeFacts())
    expect(narrative).toContain('no detecta spreads ni combos')
  })
})
