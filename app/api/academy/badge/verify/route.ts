import { NextResponse } from 'next/server'
import { findBadgeByCode } from '@/lib/academy/persistence'
import { rejectIfRateLimited } from '@/lib/server/endpoint-guards'

export async function GET(request: Request) {
  const blocked = rejectIfRateLimited(request, {
    routeKey: 'academy-badge-verify',
    limit: 120,
    windowMs: 60_000,
  })
  if (blocked) return blocked

  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')?.trim().toUpperCase()
  if (!code) {
    return NextResponse.json({ success: false, error: 'Missing query param: code' }, { status: 400 })
  }

  try {
    const badge = await findBadgeByCode(code)
    return NextResponse.json({
      success: true,
      data: {
        code,
        valid: Boolean(badge),
        badge,
      },
    })
  } catch (error) {
    console.error('[/api/academy/badge/verify] Error:', error)
    return NextResponse.json({ success: false, error: 'Failed to verify badge' }, { status: 500 })
  }
}
