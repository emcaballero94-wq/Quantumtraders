'use client'

import { useEffect, useState } from 'react'
import type { QuantumCityStateResponse, StationLive, WiredStationId } from '@/lib/quantum-city/types'

const POLL_MS = 20_000

/**
 * Polls the read-only Quantum City state aggregator (app/api/quantum-city/state)
 * on the same setInterval+fetch pattern every other live page in this app
 * already uses (see app/dashboard/page.tsx) — no new realtime infra, per
 * docs/quantum-city-architecture.md §11/§20.
 */
export function useQuantumCityLiveState(): Partial<Record<WiredStationId, StationLive>> {
  const [stations, setStations] = useState<Partial<Record<WiredStationId, StationLive>>>({})

  useEffect(() => {
    let mounted = true

    const load = async () => {
      try {
        const res = await fetch('/api/quantum-city/state')
        const payload = (await res.json()) as QuantumCityStateResponse
        if (!mounted || !payload.success) return
        setStations(payload.data.stations)
      } catch {
        // Keep whatever we last had — a transient fetch failure shouldn't
        // flip every station back to an unlabeled state.
      }
    }

    load()
    const timer = setInterval(load, POLL_MS)
    return () => {
      mounted = false
      clearInterval(timer)
    }
  }, [])

  return stations
}
