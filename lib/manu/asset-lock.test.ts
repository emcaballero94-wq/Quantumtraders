import { describe, expect, it } from 'vitest'
import { shouldSkipBrief, withAssetLock } from './asset-lock'

describe('withAssetLock', () => {
  it('collapses concurrent calls for the same asset into a single execution', async () => {
    let calls = 0
    const fn = () =>
      new Promise<number>((resolve) => {
        calls += 1
        setTimeout(() => resolve(calls), 10)
      })

    const [a, b] = await Promise.all([withAssetLock('BTCUSDT', fn), withAssetLock('BTCUSDT', fn)])
    expect(calls).toBe(1)
    expect(a).toBe(b)
  })

  it('does not block a different asset while one is in flight', async () => {
    const slow = () => new Promise<string>((resolve) => setTimeout(() => resolve('slow'), 20))
    const fast = () => Promise.resolve('fast')

    const slowPromise = withAssetLock('BTCUSDT', slow)
    const fastResult = await withAssetLock('ETHUSDT', fast)
    expect(fastResult).toBe('fast')
    await slowPromise
  })

  it('allows a fresh call once the previous one has resolved', async () => {
    let calls = 0
    const fn = async () => {
      calls += 1
      return calls
    }
    await withAssetLock('SOLUSDT', fn)
    await withAssetLock('SOLUSDT', fn)
    expect(calls).toBe(2)
  })
})

describe('shouldSkipBrief', () => {
  it('never skips when there is no prior brief', () => {
    expect(shouldSkipBrief(null, new Date(), 5000)).toBe(false)
  })

  it('skips a duplicate brief fired right after the last one', () => {
    const last = new Date('2026-01-01T00:00:00.000Z')
    const now = new Date('2026-01-01T00:00:02.000Z')
    expect(shouldSkipBrief(last, now, 5000)).toBe(true)
  })

  it('allows a new brief once the minimum interval has passed', () => {
    const last = new Date('2026-01-01T00:00:00.000Z')
    const now = new Date('2026-01-01T00:00:06.000Z')
    expect(shouldSkipBrief(last, now, 5000)).toBe(false)
  })
})
