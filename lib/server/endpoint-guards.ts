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

// Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}` on scheduled
// invocations of routes under app/api/cron/*. Fails closed when CRON_SECRET
// isn't configured — an unauthenticated cron route would let anyone trigger
// paid upstream API calls and writes on demand, not just once a day.
export function rejectIfNotCron(request: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 503 })
  }

  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return null
}
