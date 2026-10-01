'use client'

import { useCallback, useEffect, useState } from 'react'

// Remembers whether a given tour has been seen per-browser (localStorage),
// same pattern as the Academy's "done lessons" tracking — so a first-time
// visitor gets it automatically, but it never nags on every page load, and
// `start()` lets a page offer an explicit "Ver tutorial" button to replay it.
export function useTour(id: string) {
  const [active, setActive] = useState(false)

  useEffect(() => {
    try {
      const seen = localStorage.getItem(`qt_tour_seen_${id}`)
      if (!seen) setActive(true)
    } catch {
      // Private browsing / blocked storage — just don't auto-start.
    }
  }, [id])

  const start = useCallback(() => setActive(true), [])

  const close = useCallback(() => {
    setActive(false)
    try {
      localStorage.setItem(`qt_tour_seen_${id}`, '1')
    } catch {
      // Ignore — worst case the tour auto-starts again next visit.
    }
  }, [id])

  return { active, start, close }
}
