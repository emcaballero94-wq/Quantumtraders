import { NextResponse } from 'next/server'
import { enforceRateLimit } from '@/lib/server/rate-limit'
import { getActorKey } from '@/lib/server/request-utils'

export function rejectIfRateLimited(
  request: Request,
  options: { routeKey: string; limit: number; windowMs: number },
): NextResponse | null {
  const actorKey = getActorKey(request)
  const result = enforceRateLimit({
    routeKey: options.routeKey,
    actorKey,
    limit: options.limit,
    windowMs: options.windowMs,
  })

  if (result.allowed) return null

  return NextResponse.json(
    { error: 'Rate limit exceeded', retryAfterMs: result.retryAfterMs },
    {
      status: 429,
      headers: {
        'Retry-After': `${Math.ceil(result.retryAfterMs / 1000)}`,
      },
    },
  )
}
