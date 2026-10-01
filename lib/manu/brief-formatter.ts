import type { HistoricalPatternMatch, MarketEvent, MarketState, RelationshipObservation, Severity } from './types'

export type ManuStatus = 'STABLE' | 'DEVELOPING' | 'ACTIVE' | 'EVENT'
export type Confidence = 'LOW' | 'MEDIUM' | 'HIGH'

const SEVERITY_RANK: Record<Severity, number> = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 }

export function topEvent(events: MarketEvent[]): MarketEvent | null {
  if (events.length === 0) return null
  return events.reduce((a, b) => (SEVERITY_RANK[b.severity] > SEVERITY_RANK[a.severity] ? b : a))
}

export function deriveStatus(events: MarketEvent[]): ManuStatus {
  const top = topEvent(events)
  if (!top) return 'STABLE'
  if (top.severity === 'CRITICAL') return 'EVENT'
  if (top.severity === 'HIGH') return 'ACTIVE'
  return 'DEVELOPING'
}

const EVENT_LABEL: Record<MarketEvent['type'], string> = {
  PRICE_ACCELERATION: 'El precio aceleró su movimiento reciente.',
  PRICE_REVERSAL: 'El precio revirtió su dirección reciente.',
  CVD_ACCELERATION: 'El CVD aceleró — más flujo agresivo entrando en la misma dirección.',
  CVD_REVERSAL: 'El CVD revirtió su dirección reciente.',
  PRICE_CVD_DIVERGENCE: 'Precio y CVD divergen.',
  OI_BUILDUP: 'El interés abierto está en expansión.',
  OI_UNWINDING: 'El interés abierto se está contrayendo.',
  FUNDING_SHIFT: 'El funding rate cambió de régimen.',
  BID_IMBALANCE: 'El libro muestra un desequilibrio comprador.',
  ASK_IMBALANCE: 'El libro muestra un desequilibrio vendedor.',
  LIQUIDATION_SPIKE: 'Pico de liquidaciones detectado.',
  LIQUIDITY_WITHDRAWAL: 'Se retiró liquidez del libro de órdenes.',
  LIQUIDITY_INCREASE: 'Aumentó la liquidez en el libro de órdenes.',
  SPREAD_EXPANSION: 'El spread se expandió.',
  ABSORPTION_CANDIDATE: 'Posible evento de absorción.',
  ORDERFLOW_REGIME_CHANGE: 'Cambió el régimen de mercado.',
}

// "What changed" is the whole point of each cycle — if nothing did, say so
// instead of re-describing the same state every ~60s (section 13).
export function keyChangeText(events: MarketEvent[]): string {
  const top = topEvent(events)
  if (!top) return 'No significant change detected.'
  return `${EVENT_LABEL[top.type]} ${top.evidence}`
}

export function deriveConfidence(state: MarketState, historical: HistoricalPatternMatch, relationships: RelationshipObservation[]): Confidence {
  if (state.dataQuality === 'INSUFFICIENT') return 'LOW'
  if (state.dataQuality === 'DEGRADED') return 'LOW'
  if ((historical.sampleLabel === 'ROBUST_SAMPLE' || historical.sampleLabel === 'USABLE_SAMPLE') && relationships.length > 0) {
    return historical.sampleLabel === 'ROBUST_SAMPLE' ? 'HIGH' : 'MEDIUM'
  }
  return 'MEDIUM'
}

export function riskFactors(state: MarketState, relationships: RelationshipObservation[], historical: HistoricalPatternMatch): string[] {
  const factors: string[] = []

  if (state.dataQuality !== 'GOOD') {
    factors.push('Algunos datos en vivo están incompletos o degradados en este ciclo.')
  }
  if (historical.sampleLabel === 'INSUFFICIENT_SAMPLE' || historical.sampleLabel === 'LIMITED_SAMPLE') {
    factors.push(
      `La validación histórica se basa en una muestra ${historical.sampleLabel === 'INSUFFICIENT_SAMPLE' ? 'insuficiente' : 'limitada'} (n=${historical.sampleSize}).`,
    )
  }
  if (relationships.some((r) => r.observation === 'divergence')) {
    factors.push('Existe una divergencia activa entre precio y flujo — una resolución en cualquier dirección invalidaría la lectura actual.')
  }
  if (factors.length === 0) {
    factors.push('Un cambio brusco en CVD, liquidez del libro o liquidaciones podría invalidar esta lectura.')
  }

  return factors
}

// A deterministic fallback brief used only when ANTHROPIC_API_KEY isn't
// configured — every numeric section still renders correctly, just without
// AI-authored prose. Never invents a number the caller didn't already
// compute.
export function buildDeterministicNarrative(input: {
  status: ManuStatus
  keyChange: string
  state: MarketState
  events: MarketEvent[]
  relationships: RelationshipObservation[]
  historical: HistoricalPatternMatch
  confidence: Confidence
}): string {
  // status/keyChange/confidence are rendered separately by the UI (badge +
  // dedicated "Key change" block) — this narrative only covers the prose
  // sections, to match what generateAiNarrative asks Claude for, and to
  // avoid showing the same STATUS/KEY CHANGE/CONFIDENCE twice on screen.
  const { state, relationships, historical } = input
  const h15 = historical.horizons['15m']

  const lines = [
    'FLOW',
    `CVD: ${state.cvd !== null ? state.cvd.toFixed(3) : 'sin dato'} (Δ1m ${state.cvdDelta1m !== null ? state.cvdDelta1m.toFixed(3) : 'sin dato'}).`,
    '',
    'LEVEL 2',
    `Desequilibrio del libro: ${state.orderBookImbalance !== null ? state.orderBookImbalance.toFixed(4) : 'sin dato'}. Spread: ${state.spread !== null ? state.spread : 'sin dato'}.`,
    '',
    'DERIVATIVES',
    `OI Δ5m: ${state.openInterestChange5m !== null ? `${state.openInterestChange5m.toFixed(2)}%` : 'sin dato'}. Funding: ${state.funding !== null ? `${(state.funding * 100).toFixed(4)}%` : 'sin dato'}.`,
    '',
    'RELATIONSHIPS',
    relationships.length > 0 ? relationships.map((r) => r.detail).join(' ') : 'Sin relaciones destacadas en este ciclo.',
    '',
    'HISTORICAL CONTEXT',
    historical.sampleLabel === 'INSUFFICIENT_SAMPLE'
      ? 'Historical validation unavailable: insufficient observations.'
      : `n=${historical.sampleSize} (${historical.sampleLabel}). 15m: tasa positiva ${h15.positiveRatePct?.toFixed(1) ?? 'sin dato'}%, mediana ${h15.medianReturnPct?.toFixed(3) ?? 'sin dato'}%, media ${h15.meanReturnPct?.toFixed(3) ?? 'sin dato'}%.`,
  ]

  return lines.join('\n')
}
