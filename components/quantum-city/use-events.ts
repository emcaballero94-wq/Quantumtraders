'use client'

import { useEffect, useRef, useState } from 'react'
import type { CityEvent, QuantumCityEventsResponse } from '@/lib/quantum-city/types'

const POLL_MS = 20_000

export interface EventsState {
  events: CityEvent[]
  /** Event ids that are new since the previous poll — consumed once to spawn a travel pulse, then cleared. */
  freshIds: string[]
}

/**
 * Polls the Quantum City event bus (app/api/quantum-city/events) and tracks
 * which ids are new since the last poll, so the scene can spawn a one-shot
 * "traveling to Mando" pulse only for events that actually just happened —
 * never a fabricated/looping animation (docs/quantum-city-architecture.md §37).
 */
export function useQuantumCityEvents(): EventsState {
  const [state, setState] = useState<EventsState>({ events: [], freshIds: [] })
  const seenIds = useRef<Set<string>>(new Set())
  const isFirstLoad = useRef(true)

  useEffect(() => {
    let mounted = true

    const load = async () => {
      try {
        const res = await fetch('/api/quantum-city/events')
        const payload = (await res.json()) as QuantumCityEventsResponse
        if (!mounted || !payload.success) return

        const { events } = payload.data
        const fresh = isFirstLoad.current ? [] : events.filter((e) => !seenIds.current.has(e.id)).map((e) => e.id)
        events.forEach((e) => seenIds.current.add(e.id))
        isFirstLoad.current = false

        setState({ events, freshIds: fresh })
      } catch {
        // Keep the last known events — a transient fetch failure shouldn't
        // clear a timeline the trader might be reading.
      }
    }

    load()
    const timer = setInterval(load, POLL_MS)
    return () => {
      mounted = false
      clearInterval(timer)
    }
  }, [])

  return state
}
