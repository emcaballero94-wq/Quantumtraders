'use client'

import { useCallback, useEffect, useState } from 'react'

// Remembers whether a given tour has been seen per-browser (localStorage),
// same pattern as the Academy's "done lessons" tracking — so a first-time
// visitor gets it automatically, but it never nags on every page load, and
// `start()` lets a page offer an explicit "Ver tutorial" button to replay it.
export function useTour(id: string) {
  const [active, setActive] = useState(false)

  useEffect(() => {
    // `?tour=<id>` lets another page (e.g. the Command feature grid) link
    // straight into a tour on first click, even if this browser already
    // marked it seen. Read via window.location rather than useSearchParams
    // so this hook never forces its host page into a Suspense boundary.
    let forceStart = false
    try {
      const params = new URLSearchParams(window.location.search)
      forceStart = params.get('tour') === id
      if (forceStart) {
        params.delete('tour')
        const query = params.toString()
        window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}`)
      }
    } catch {
      // ignore — worst case the query param lingers in the URL
    }

    try {
      const seen = localStorage.getItem(`qt_tour_seen_${id}`)
      if (forceStart || !seen) setActive(true)
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
