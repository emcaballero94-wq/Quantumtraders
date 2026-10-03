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

// ---------------------------------------------------------------- tree layout
//
// The floor follows the Tree of Life the user sketched: 10 circles joined by
// 19 lines. Coordinates are taken straight from that sketch (pixels, center
// circle at 291,290) and scaled to floor units, so the proportions match it.
// Up in the sketch = toward the back of the floor (-z).

export type TreeSlot = 'keter' | 'binah' | 'chokmah' | 'gevurah' | 'chesed' | 'tiferet' | 'hod' | 'netzach' | 'yesod' | 'malkuth'

const SKETCH_SCALE = 0.08
const fromSketch = (x: number, y: number): [number, number] => [
  Math.round((x - 291) * SKETCH_SCALE * 100) / 100,
  Math.round((y - 290) * SKETCH_SCALE * 100) / 100,
]

export const TREE_SLOTS: Record<TreeSlot, [number, number]> = {
  keter: fromSketch(291, 62),
  binah: fromSketch(190, 118),
  chokmah: fromSketch(392, 118),
  gevurah: fromSketch(190, 232),
  chesed: fromSketch(392, 232),
  tiferet: fromSketch(291, 290),
  hod: fromSketch(190, 346),
  netzach: fromSketch(392, 346),
  yesod: fromSketch(291, 405),
  malkuth: fromSketch(291, 519),
}

/** The lines in the sketch. Couriers walk along these to reach M.A.N.U. */
export const TREE_PATHS: [TreeSlot, TreeSlot][] = [
  ['keter', 'binah'], ['keter', 'chokmah'], ['keter', 'tiferet'], ['binah', 'chokmah'],
  ['binah', 'gevurah'], ['chokmah', 'chesed'], ['gevurah', 'chesed'],
  ['gevurah', 'tiferet'], ['chesed', 'tiferet'], ['gevurah', 'hod'], ['chesed', 'netzach'],
  ['hod', 'tiferet'], ['netzach', 'tiferet'], ['tiferet', 'yesod'],
  ['hod', 'yesod'], ['netzach', 'yesod'], ['hod', 'malkuth'], ['netzach', 'malkuth'], ['yesod', 'malkuth'],
]

// JOURNAL and REVIEW share the bottom circle (11 real engines, 10 circles):
// each gets half of it.
const TWIN_OFFSET = 2.9
/** z of the pipeline row, and of the dashed divider in front of it. */
export const PIPELINE_Z = -25
export const PIPELINE_DIVIDER_Z = -21.5
const [MX, MZ] = TREE_SLOTS.malkuth

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
  /** Circle of the tree this station sits on; none = the separate pipeline row. */
  slot: TreeSlot | null
}

export const QUANTUM_CITY_STATIONS: StationDef[] = [
  { id: 'mando', name: 'M.A.N.U.', subtitle: 'Mando · IA', href: '/dashboard', cssColorVar: '--c-ink-muted', position: TREE_SLOTS.tiferet, radius: 1.8, implemented: true, slot: 'tiferet' },
  { id: 'pulse', name: 'MACRO', subtitle: 'Pulse · Market state', href: '/dashboard/pulse', cssColorVar: '--c-pulse', position: TREE_SLOTS.keter, radius: 1, implemented: true, slot: 'keter' },
  { id: 'options', name: 'OPTIONS', subtitle: 'Options Flow · Deribit', href: '/dashboard/options', cssColorVar: '--c-oracle', position: TREE_SLOTS.binah, radius: 1, implemented: true, slot: 'binah' },
  { id: 'gex', name: 'GEX', subtitle: 'Gamma exposure', href: '/dashboard/gex', cssColorVar: '--c-nexus', position: TREE_SLOTS.chokmah, radius: 1, implemented: true, slot: 'chokmah' },
  { id: 'atlas', name: 'ATLAS', subtitle: 'Charts · Technical', href: '/dashboard/atlas', cssColorVar: '--c-atlas', position: TREE_SLOTS.gevurah, radius: 1, implemented: true, slot: 'gevurah' },
  { id: 'orderflow', name: 'FLOW', subtitle: 'Order Flow · Level 2', href: '/dashboard/orderflow', cssColorVar: '--c-atlas', position: TREE_SLOTS.chesed, radius: 1, implemented: true, slot: 'chesed' },
  { id: 'nexus', name: 'NEXUS', subtitle: 'Correlations', href: '/dashboard/nexus', cssColorVar: '--c-nexus', position: TREE_SLOTS.hod, radius: 1, implemented: true, slot: 'hod' },
  { id: 'scanner', name: 'SCANNER', subtitle: 'Condition screener', href: '/dashboard/scanner', cssColorVar: '--c-oracle', position: TREE_SLOTS.netzach, radius: 1, implemented: true, slot: 'netzach' },
  { id: 'mind', name: 'MIND', subtitle: 'Trading psychology', href: '/dashboard/mind', cssColorVar: '--c-atlas', position: TREE_SLOTS.yesod, radius: 1, implemented: true, slot: 'yesod' },
  { id: 'tools', name: 'JOURNAL', subtitle: 'Trade audit', href: '/dashboard/tools', cssColorVar: '--c-ink-muted', position: [MX - TWIN_OFFSET, MZ], radius: 1, implemented: true, slot: 'malkuth' },
  { id: 'review', name: 'REVIEW', subtitle: 'Outcome tracking · Options Flow', href: '/dashboard/options', cssColorVar: '--c-nexus', position: [MX + TWIN_OFFSET, MZ], radius: 1, implemented: true, slot: 'malkuth' },

  // "Pipeline" row — grouped apart from the real engines above on purpose,
  // so the floor itself communicates the gap instead of hiding it. It sits
  // behind the top of the tree.
  { id: 'strategy', name: 'STRATEGY', subtitle: 'No backend yet', href: null, cssColorVar: '--c-ink-muted', position: [-6, PIPELINE_Z], radius: 0.85, implemented: false, slot: null },
  { id: 'risk', name: 'RISK', subtitle: 'No backend yet', href: null, cssColorVar: '--c-ink-muted', position: [0, PIPELINE_Z], radius: 0.85, implemented: false, slot: null },
  { id: 'execution', name: 'EXECUTION', subtitle: 'No backend yet', href: null, cssColorVar: '--c-ink-muted', position: [6, PIPELINE_Z], radius: 0.85, implemented: false, slot: null },
]
