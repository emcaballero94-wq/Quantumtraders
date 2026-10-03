// Quantum City station registry.
//
// Layout: the 10 real, implemented engines sit on the 10 Sephirot positions
// of the Kabbalistic Tree of Life (the shape the user asked for), with MANDO
// as the crown ABOVE the tree — the source everything else answers to,
// rather than a hub at the center. The assignment of engine → Sephirah is a
// thematic fit (e.g. Yesod/foundation ↔ Mind's psychology, Malkuth/the
// material world ↔ Journal's recorded real outcomes), not an exact esoteric
// claim.
//
// We deliberately do NOT draw the traditional 22 paths between all 10 nodes
// — that would visually claim relationships between engines that don't
// exist (Scanner and Mind have nothing to do with each other). Only the
// connections that are actually real are drawn (see QuantumCityScene's
// Connectors): every station → Mando, and GEX → Flow, the one real
// cross-engine read in the codebase. GEX and Flow sit on the same tier
// (Gevurah/Chesed) so that one real edge is also the shortest line in the
// tree — more relationships can be added here later as real ones are built.
//
// Every entry marked `implemented: true` corresponds to a REAL existing
// Quantum Traders route/engine (see docs/quantum-city-architecture.md §2).
// Strategy/Risk/Execution sit below the tree because the product brief's
// full department layout expects them visually, but their backends do not
// exist — they render dormant/grey, never animated, and the inspector says
// so plainly. Faking activity for them would violate the brief's own §0/§37
// "no fake agent activity" rule, so `implemented: false` is load-bearing,
// not decorative.
//
// REVIEW graduated into the tree in Phase 4: `brief_outcomes` +
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
  /** Footprint radius — Mando is deliberately larger, it's the crown of the tree. */
  radius: number
  /** False = no backend exists yet (see docs §2). Must render dormant, never animated. */
  implemented: boolean
}

export const QUANTUM_CITY_STATIONS: StationDef[] = [
  // Crown, above the tree.
  { id: 'mando', name: 'MANDO', subtitle: 'Command · Cockpit', href: '/dashboard', cssColorVar: '--c-ink-muted', position: [0, -16], radius: 1.8, implemented: true },

  // Keter.
  { id: 'pulse', name: 'MACRO', subtitle: 'Pulse · Market state', href: '/dashboard/pulse', cssColorVar: '--c-pulse', position: [0, -12], radius: 1, implemented: true },

  // Binah (left) / Chokmah (right).
  { id: 'atlas', name: 'ATLAS', subtitle: 'Charts · Technical', href: '/dashboard/atlas', cssColorVar: '--c-atlas', position: [-5, -8.5], radius: 1, implemented: true },
  { id: 'scanner', name: 'SCANNER', subtitle: 'Condition screener', href: '/dashboard/scanner', cssColorVar: '--c-oracle', position: [5, -8.5], radius: 1, implemented: true },

  // Gevurah (left) / Chesed (right) — the one real cross-engine edge sits here.
  { id: 'gex', name: 'GEX', subtitle: 'Gamma exposure', href: '/dashboard/gex', cssColorVar: '--c-nexus', position: [-5, -5], radius: 1, implemented: true },
  { id: 'orderflow', name: 'FLOW', subtitle: 'Order Flow · Level 2', href: '/dashboard/orderflow', cssColorVar: '--c-atlas', position: [5, -5], radius: 1, implemented: true },

  // Tiferet — the heart of the tree.
  { id: 'nexus', name: 'NEXUS', subtitle: 'Correlations', href: '/dashboard/nexus', cssColorVar: '--c-nexus', position: [0, -1.5], radius: 1, implemented: true },

  // Hod (left) / Netzach (right).
  { id: 'options', name: 'OPTIONS', subtitle: 'Options Flow · Deribit', href: '/dashboard/options', cssColorVar: '--c-oracle', position: [-5, 2], radius: 1, implemented: true },
  { id: 'review', name: 'REVIEW', subtitle: 'Outcome tracking · Options Flow', href: '/dashboard/options', cssColorVar: '--c-nexus', position: [5, 2], radius: 1, implemented: true },

  // Yesod.
  { id: 'mind', name: 'MIND', subtitle: 'Trading psychology', href: '/dashboard/mind', cssColorVar: '--c-atlas', position: [0, 5.5], radius: 1, implemented: true },

  // Malkuth — the material result.
  { id: 'tools', name: 'JOURNAL', subtitle: 'Trade audit', href: '/dashboard/tools', cssColorVar: '--c-ink-muted', position: [0, 9], radius: 1, implemented: true },

  // Below the tree — grouped apart from it on purpose, so the floor itself
  // communicates the gap instead of hiding it.
  { id: 'strategy', name: 'STRATEGY', subtitle: 'No backend yet', href: null, cssColorVar: '--c-ink-muted', position: [-5, 13], radius: 0.85, implemented: false },
  { id: 'risk', name: 'RISK', subtitle: 'No backend yet', href: null, cssColorVar: '--c-ink-muted', position: [0, 13], radius: 0.85, implemented: false },
  { id: 'execution', name: 'EXECUTION', subtitle: 'No backend yet', href: null, cssColorVar: '--c-ink-muted', position: [5, 13], radius: 0.85, implemented: false },
]
