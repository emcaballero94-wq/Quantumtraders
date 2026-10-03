// Quantum City station registry.
//
// Every entry marked `implemented: true` corresponds to a REAL existing
// Quantum Traders route/engine (see docs/quantum-city-architecture.md §2).
// Strategy/Risk/Execution are included because the product brief's full
// department layout expects them visually, but their backends do not exist
// — they render dormant/grey, never animated, and the inspector says so
// plainly. Faking activity for them would violate the brief's own §0/§37
// "no fake agent activity" rule, so `implemented: false` is load-bearing,
// not decorative.
//
// REVIEW graduated out of that dormant row in Phase 4: `brief_outcomes` +
// computeAccuracySummary('options_flow', 'BTC') (lib/manu-options-flow/
// outcome-persistence.ts) is a real, if narrow, prediction-vs-actual engine
// — it scores whether Options Flow's BULLISH/BEARISH/NEUTRAL lean was right
// 24h later. That's the only genuine "review" logic anywhere in the
// codebase (see docs §2's audit), so it's the only honest claim Review gets
// to make — it is NOT a general trade-review or pattern-detection engine.
//
// `cssColorVar` must match a color token already defined in app/globals.css
// (the same ones used by Sidebar.tsx's nav dots) so Quantum City never
// invents a new chromatic identity — it reads the app's real theme.

export type StationId =
  | 'mando'
  | 'scanner'
  | 'atlas'
  | 'nexus'
  | 'pulse'
  | 'orderflow'
  | 'gex'
  | 'options'
  | 'tools'
  | 'mind'
  | 'strategy'
  | 'risk'
  | 'execution'
  | 'review'

export interface StationDef {
  id: StationId
  name: string
  subtitle: string
  href: string | null
  cssColorVar: '--c-atlas' | '--c-nexus' | '--c-pulse' | '--c-oracle' | '--c-ink-muted'
  /** [x, z] position on the floor plane; y is derived per-station. */
  position: [number, number]
  /** Footprint radius — Mando is deliberately larger, it's the center of the floor. */
  radius: number
  /** False = no backend exists yet (see docs §2). Must render dormant, never animated. */
  implemented: boolean
}

export const QUANTUM_CITY_STATIONS: StationDef[] = [
  { id: 'mando', name: 'M.A.N.U.', subtitle: 'Mando · IA', href: '/dashboard', cssColorVar: '--c-ink-muted', position: [0, 0], radius: 1.8, implemented: true },
  { id: 'scanner', name: 'SCANNER', subtitle: 'Condition screener', href: '/dashboard/scanner', cssColorVar: '--c-oracle', position: [-7, -6], radius: 1, implemented: true },
  { id: 'atlas', name: 'ATLAS', subtitle: 'Charts · Technical', href: '/dashboard/atlas', cssColorVar: '--c-atlas', position: [-9.5, 2.5], radius: 1, implemented: true },
  { id: 'nexus', name: 'NEXUS', subtitle: 'Correlations', href: '/dashboard/nexus', cssColorVar: '--c-nexus', position: [-5.5, 9.5], radius: 1, implemented: true },
  { id: 'pulse', name: 'MACRO', subtitle: 'Pulse · Market state', href: '/dashboard/pulse', cssColorVar: '--c-pulse', position: [0, 11.5], radius: 1, implemented: true },
  { id: 'orderflow', name: 'FLOW', subtitle: 'Order Flow · Level 2', href: '/dashboard/orderflow', cssColorVar: '--c-atlas', position: [7, 6], radius: 1, implemented: true },
  { id: 'gex', name: 'GEX', subtitle: 'Gamma exposure', href: '/dashboard/gex', cssColorVar: '--c-nexus', position: [9.5, -2.5], radius: 1, implemented: true },
  { id: 'options', name: 'OPTIONS', subtitle: 'Options Flow · Deribit', href: '/dashboard/options', cssColorVar: '--c-oracle', position: [6, -9.5], radius: 1, implemented: true },
  { id: 'tools', name: 'JOURNAL', subtitle: 'Trade audit', href: '/dashboard/tools', cssColorVar: '--c-ink-muted', position: [-1.5, -11.5], radius: 1, implemented: true },
  { id: 'mind', name: 'MIND', subtitle: 'Trading psychology', href: '/dashboard/mind', cssColorVar: '--c-atlas', position: [2.5, -7.5], radius: 1, implemented: true },
  { id: 'review', name: 'REVIEW', subtitle: 'Outcome tracking · Options Flow', href: '/dashboard/options', cssColorVar: '--c-nexus', position: [10, -9.5], radius: 1, implemented: true },

  // "Pipeline" row — grouped apart from the real engines above on purpose,
  // so the floor itself communicates the gap instead of hiding it.
  { id: 'strategy', name: 'STRATEGY', subtitle: 'No backend yet', href: null, cssColorVar: '--c-ink-muted', position: [-5, -17], radius: 0.85, implemented: false },
  { id: 'risk', name: 'RISK', subtitle: 'No backend yet', href: null, cssColorVar: '--c-ink-muted', position: [0, -17], radius: 0.85, implemented: false },
  { id: 'execution', name: 'EXECUTION', subtitle: 'No backend yet', href: null, cssColorVar: '--c-ink-muted', position: [5, -17], radius: 0.85, implemented: false },
]
