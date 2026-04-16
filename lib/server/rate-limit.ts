type Bucket = {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

function buildKey(routeKey: string, actorKey: string): string {
  return `${routeKey}::${actorKey || 'anonymous'}`
}

export function enforceRateLimit(input: {
  routeKey: string
  actorKey: string
  limit: number
  windowMs: number
}): { allowed: boolean; remaining: number; retryAfterMs: number } {
  const now = Date.now()
  const key = buildKey(input.routeKey, input.actorKey)
  const existing = buckets.get(key)

  if (!existing || now >= existing.resetAt) {
    const fresh: Bucket = {
      count: 1,
      resetAt: now + input.windowMs,
    }
    buckets.set(key, fresh)
    return {
      allowed: true,
      remaining: Math.max(input.limit - 1, 0),
      retryAfterMs: input.windowMs,
    }
  }

  if (existing.count >= input.limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: Math.max(existing.resetAt - now, 0),
    }
  }

  existing.count += 1
  buckets.set(key, existing)
  return {
    allowed: true,
    remaining: Math.max(input.limit - existing.count, 0),
    retryAfterMs: Math.max(existing.resetAt - now, 0),
  }
}
