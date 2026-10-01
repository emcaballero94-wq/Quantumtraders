// Per-asset debounce: collapses concurrent/duplicate calls (multiple tabs,
// a client-side retry racing the original request) into a single in-flight
// analysis, instead of running M.A.N.U. — and calling Claude — twice for the
// same asset at the same time.
const inFlight = new Map<string, Promise<unknown>>()

export async function withAssetLock<T>(asset: string, fn: () => Promise<T>): Promise<T> {
  const existing = inFlight.get(asset)
  if (existing) return existing as Promise<T>

  const promise = fn().finally(() => {
    inFlight.delete(asset)
  })
  inFlight.set(asset, promise)
  return promise
}

// A light guard against firing a new brief right on top of one that was just
// generated (e.g. a HIGH-severity event landing seconds after the normal
// 60s-cycle brief already ran).
export function shouldSkipBrief(lastBriefAt: Date | null, now: Date, minIntervalMs: number): boolean {
  if (!lastBriefAt) return false
  return now.getTime() - lastBriefAt.getTime() < minIntervalMs
}
