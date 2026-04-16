import { getActorKey } from '@/lib/server/request-utils'

function sanitizeLearnerId(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 64)
}

export function resolveLearnerId(request: Request): string {
  const { searchParams } = new URL(request.url)
  const queryId = searchParams.get('learnerId')
  if (queryId) {
    const clean = sanitizeLearnerId(queryId)
    if (clean.length > 0) return clean
  }

  const headerId = request.headers.get('x-learner-id')
  if (headerId) {
    const clean = sanitizeLearnerId(headerId)
    if (clean.length > 0) return clean
  }

  const actor = sanitizeLearnerId(getActorKey(request))
  return actor.length > 0 ? `guest-${actor}` : 'guest-anonymous'
}
