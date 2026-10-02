import { afterEach, describe, expect, it, vi } from 'vitest'
import { isOwnerEmail } from './access-control'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('isOwnerEmail', () => {
  it('returns false for null/undefined/empty', () => {
    expect(isOwnerEmail(null)).toBe(false)
    expect(isOwnerEmail(undefined)).toBe(false)
    expect(isOwnerEmail('')).toBe(false)
  })

  it('matches the hardcoded default owner email case-insensitively', () => {
    expect(isOwnerEmail('em.caballero94@gmail.com')).toBe(true)
    expect(isOwnerEmail('EM.Caballero94@Gmail.com')).toBe(true)
  })

  it('rejects an arbitrary email not on the list', () => {
    expect(isOwnerEmail('random.visitor@example.com')).toBe(false)
  })

  it('honors OWNER_EMAILS when set, overriding the default', () => {
    vi.stubEnv('OWNER_EMAILS', 'teammate@example.com, other@example.com')
    expect(isOwnerEmail('teammate@example.com')).toBe(true)
    expect(isOwnerEmail('other@example.com')).toBe(true)
    expect(isOwnerEmail('em.caballero94@gmail.com')).toBe(false)
  })

  it('falls back to the default when OWNER_EMAILS is set but empty/blank', () => {
    vi.stubEnv('OWNER_EMAILS', '   ')
    expect(isOwnerEmail('em.caballero94@gmail.com')).toBe(true)
  })
})
