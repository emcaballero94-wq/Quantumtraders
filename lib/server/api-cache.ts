type CacheEntry<T> = {
  value: T
  expiresAt: number
}

const cache = new Map<string, CacheEntry<unknown>>()

export function getCachedValue<T>(key: string): T | null {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() >= entry.expiresAt) {
    cache.delete(key)
    return null
  }
  return entry.value as T
}

export function setCachedValue<T>(key: string, value: T, ttlMs: number): void {
  cache.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  })
}

export async function withApiCache<T>(
  key: string,
  ttlMs: number,
  resolver: () => Promise<T>,
): Promise<T> {
  const cached = getCachedValue<T>(key)
  if (cached !== null) return cached
  const resolved = await resolver()
  setCachedValue(key, resolved, ttlMs)
  return resolved
}
