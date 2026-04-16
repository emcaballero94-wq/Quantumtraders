import type { NextRequest } from 'next/server'

export function getActorKey(request: Request | NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor && forwardedFor.length > 0) {
    return forwardedFor.split(',')[0]?.trim() || 'anonymous'
  }

  const realIp = request.headers.get('x-real-ip')
  if (realIp && realIp.length > 0) return realIp

  return 'anonymous'
}
