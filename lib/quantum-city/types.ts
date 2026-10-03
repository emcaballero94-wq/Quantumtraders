// Shared between the read-only aggregator route (app/api/quantum-city/state)
// and the client-side Quantum City components — kept in `lib` (not the route
// file) so client components can import the type without pulling in any
// server-only persistence code.

export type StationLiveState = 'idle' | 'active' | 'alert'

export interface StationLive {
  state: StationLiveState
  detail: string
  lastUpdated: string | null
}

// Only the stations Phase 2 actually wired to real data (see the route for
// why Atlas/Nexus/Mind are excluded — they have no honest server-side signal
// yet).
export type WiredStationId = 'mando' | 'scanner' | 'pulse' | 'orderflow' | 'gex' | 'options' | 'tools' | 'review'

export type QuantumCityStateResponse = {
  success: true
  data: {
    generatedAt: string
    stations: Record<WiredStationId, StationLive>
  }
} | {
  success: false
  error: string
}

// Phase 3 — event bus. Every entry here is a REAL, already-persisted fact
// (a market event, a brief being generated, a trade being logged) — this is
// a read-only merge of existing tables, never a synthetic/invented event.
// `station` says which station the event visually belongs to, so the client
// can animate it traveling from that station toward Mando.
export type CityEventSeverity = 'low' | 'medium' | 'high' | 'critical'

export interface CityEvent {
  id: string
  station: WiredStationId
  timestamp: string
  label: string
  severity: CityEventSeverity
}

export type QuantumCityEventsResponse = {
  success: true
  data: { events: CityEvent[] }
} | {
  success: false
  error: string
}
