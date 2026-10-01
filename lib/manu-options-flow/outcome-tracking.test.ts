import { describe, expect, it } from 'vitest'
import { classifyActualDirection, computeOutcome, wasLeanCorrect } from './outcome-tracking'

describe('classifyActualDirection', () => {
  it('reports up above the flat band', () => {
    expect(classifyActualDirection(1.5)).toBe('up')
  })

  it('reports down below the flat band', () => {
    expect(classifyActualDirection(-1.5)).toBe('down')
  })

  it('reports flat within the band, including exactly at the boundary', () => {
    expect(classifyActualDirection(0)).toBe('flat')
    expect(classifyActualDirection(1)).toBe('flat')
    expect(classifyActualDirection(-1)).toBe('flat')
  })
})

describe('wasLeanCorrect', () => {
  it('BULLISH is correct only when price went up', () => {
    expect(wasLeanCorrect('BULLISH', 'up')).toBe(true)
    expect(wasLeanCorrect('BULLISH', 'down')).toBe(false)
    expect(wasLeanCorrect('BULLISH', 'flat')).toBe(false)
  })

  it('BEARISH is correct only when price went down', () => {
    expect(wasLeanCorrect('BEARISH', 'down')).toBe(true)
    expect(wasLeanCorrect('BEARISH', 'up')).toBe(false)
  })

  it('NEUTRAL is correct only when price stayed flat — not an automatic pass', () => {
    expect(wasLeanCorrect('NEUTRAL', 'flat')).toBe(true)
    expect(wasLeanCorrect('NEUTRAL', 'up')).toBe(false)
    expect(wasLeanCorrect('NEUTRAL', 'down')).toBe(false)
  })
})

describe('computeOutcome', () => {
  it('computes a positive change and marks a BULLISH lean correct', () => {
    const outcome = computeOutcome('BULLISH', 100, 103)
    expect(outcome.priceChangePct).toBeCloseTo(3)
    expect(outcome.actualDirection).toBe('up')
    expect(outcome.correct).toBe(true)
  })

  it('computes a negative change and marks a BULLISH lean incorrect', () => {
    const outcome = computeOutcome('BULLISH', 100, 95)
    expect(outcome.priceChangePct).toBeCloseTo(-5)
    expect(outcome.actualDirection).toBe('down')
    expect(outcome.correct).toBe(false)
  })

  it('treats a tiny move as flat regardless of lean direction', () => {
    const outcome = computeOutcome('BEARISH', 100, 100.3)
    expect(outcome.actualDirection).toBe('flat')
    expect(outcome.correct).toBe(false)
  })
})
