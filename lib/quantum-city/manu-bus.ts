// A tiny in-page signal from the M.A.N.U. chat (components/layout/QuantumAI)
// to Quantum City, so a question asked in the chat shows up on the floor.
//
// `sources` is never guessed on the client: /api/oracle/chat reports which
// engines' data it actually put into the answer's context (radar, candles/
// quote, GEX brief, Order Flow brief). Nothing is persisted — this lives only
// for the current tab, like the chat itself.

/** Floor stations whose data the chat route can read (see buildRealTimeContext). */
export type ManuSource = 'scanner' | 'atlas' | 'gex' | 'orderflow'

export type ManuSignal =
  | { phase: 'thinking'; question: string }
  | { phase: 'answered'; question: string; sources: ManuSource[]; symbol: string | null }
  | { phase: 'failed' }

const EVENT_NAME = 'quantum-city:manu'

export function emitManuSignal(signal: ManuSignal) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent<ManuSignal>(EVENT_NAME, { detail: signal }))
}

export function onManuSignal(handler: (signal: ManuSignal) => void): () => void {
  const listener = (e: Event) => handler((e as CustomEvent<ManuSignal>).detail)
  window.addEventListener(EVENT_NAME, listener)
  return () => window.removeEventListener(EVENT_NAME, listener)
}
