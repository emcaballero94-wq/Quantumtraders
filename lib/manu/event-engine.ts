import type { ChangeClass, MarketEvent, MarketState, MarketRegime, Severity } from './types'
import { detectPriceCvdDivergence } from './relationships'

export interface PreviousLiveSnapshot {
  bidDepth: number | null
  askDepth: number | null
  spread: number | null
}

export interface ChangeClassifications {
  price: ChangeClass | null
  cvd: ChangeClass | null
  openInterest: ChangeClass | null
  funding: ChangeClass | null
}

export interface LiquidationDeltas {
  long: number | null
  short: number | null
}

// Dollar thresholds for a liquidation SPIKE, measured over the last ~1
// minute (a delta, never the raw cumulative session total — see
// detectLiquidationReset in market-state.ts for why cumulative totals alone
// are useless as a spike signal). Tunable, not calibrated statistically.
const LIQUIDATION_THRESHOLDS = { medium: 5_000, high: 50_000, critical: 250_000 }
const DEPTH_CHANGE_THRESHOLD_PCT = 30
const SPREAD_EXPANSION_MULTIPLE = 2
const IMBALANCE_MEDIUM_THRESHOLD = 5
const IMBALANCE_HIGH_MULTIPLE = 2
const ABSORPTION_PRICE_FLAT_PCT = 0.03
const ABSORPTION_OI_RISING_PCT = 0.1
const ABSORPTION_CVD_MOVING = 0.5

function severityForMagnitude(value: number, thresholds: { medium: number; high: number; critical: number }): Severity {
  if (value >= thresholds.critical) return 'CRITICAL'
  if (value >= thresholds.high) return 'HIGH'
  if (value >= thresholds.medium) return 'MEDIUM'
  return 'LOW'
}

function severityForClass(cls: ChangeClass): Severity {
  switch (cls) {
    case 'ANOMALOUS':
      return 'HIGH'
    case 'REVERSING':
    case 'ACCELERATING':
      return 'MEDIUM'
    default:
      return 'LOW'
  }
}

export function buildEvents(
  state: MarketState,
  changes: ChangeClassifications,
  previousLive: PreviousLiveSnapshot | null,
  previousRegime: MarketRegime | null,
  liquidationDeltas: LiquidationDeltas | null,
): MarketEvent[] {
  const events: MarketEvent[] = []
  const base = { asset: state.asset, timestamp: state.timestamp }

  if (changes.price === 'ACCELERATING' || changes.price === 'ANOMALOUS') {
    events.push({
      ...base,
      type: 'PRICE_ACCELERATION',
      severity: severityForClass(changes.price),
      evidence: `Precio clasificado como ${changes.price} en la última ventana de 1 minuto.`,
      values: { priceChange1m: state.priceChange1m },
      previousValues: {},
    })
  } else if (changes.price === 'REVERSING') {
    events.push({
      ...base,
      type: 'PRICE_REVERSAL',
      severity: severityForClass(changes.price),
      evidence: 'El precio revirtió de dirección respecto a la ventana anterior de 1 minuto.',
      values: { priceChange1m: state.priceChange1m },
      previousValues: {},
    })
  }

  if (changes.cvd === 'ACCELERATING' || changes.cvd === 'ANOMALOUS') {
    events.push({
      ...base,
      type: 'CVD_ACCELERATION',
      severity: severityForClass(changes.cvd),
      evidence: `CVD clasificado como ${changes.cvd} en la última ventana de 1 minuto.`,
      values: { cvdDelta1m: state.cvdDelta1m },
      previousValues: {},
    })
  } else if (changes.cvd === 'REVERSING') {
    events.push({
      ...base,
      type: 'CVD_REVERSAL',
      severity: severityForClass(changes.cvd),
      evidence: 'El CVD revirtió de dirección respecto a la ventana anterior de 1 minuto.',
      values: { cvdDelta1m: state.cvdDelta1m },
      previousValues: {},
    })
  }

  if (detectPriceCvdDivergence(state)) {
    events.push({
      ...base,
      type: 'PRICE_CVD_DIVERGENCE',
      severity: 'MEDIUM',
      evidence: 'El precio y el CVD se mueven en direcciones opuestas en la ventana de 5 minutos.',
      values: { priceChange5m: state.priceChange5m, cvdDelta5m: state.cvdDelta5m },
      previousValues: {},
    })
  }

  if (state.openInterestChange5m !== null && (changes.openInterest === 'ACCELERATING' || changes.openInterest === 'SHIFTING' || changes.openInterest === 'ANOMALOUS')) {
    if (state.openInterestChange5m > 0) {
      events.push({
        ...base,
        type: 'OI_BUILDUP',
        severity: severityForClass(changes.openInterest),
        evidence: `Open interest +${state.openInterestChange5m.toFixed(2)}% en 5 minutos.`,
        values: { openInterestChange5m: state.openInterestChange5m },
        previousValues: {},
      })
    } else if (state.openInterestChange5m < 0) {
      events.push({
        ...base,
        type: 'OI_UNWINDING',
        severity: severityForClass(changes.openInterest),
        evidence: `Open interest ${state.openInterestChange5m.toFixed(2)}% en 5 minutos.`,
        values: { openInterestChange5m: state.openInterestChange5m },
        previousValues: {},
      })
    }
  }

  if (changes.funding && changes.funding !== 'UNCHANGED') {
    events.push({
      ...base,
      type: 'FUNDING_SHIFT',
      severity: severityForClass(changes.funding),
      evidence: `Funding clasificado como ${changes.funding}.`,
      values: { funding: state.funding, fundingChange: state.fundingChange },
      previousValues: {},
    })
  }

  if (state.orderBookImbalance !== null && Math.abs(state.orderBookImbalance) >= IMBALANCE_MEDIUM_THRESHOLD) {
    events.push({
      ...base,
      type: state.orderBookImbalance > 0 ? 'BID_IMBALANCE' : 'ASK_IMBALANCE',
      severity: Math.abs(state.orderBookImbalance) >= IMBALANCE_MEDIUM_THRESHOLD * IMBALANCE_HIGH_MULTIPLE ? 'MEDIUM' : 'LOW',
      evidence: `Desequilibrio del libro: ${state.orderBookImbalance.toFixed(4)}.`,
      values: { orderBookImbalance: state.orderBookImbalance },
      previousValues: {},
    })
  }

  if (liquidationDeltas) {
    const dominant =
      liquidationDeltas.long !== null && liquidationDeltas.short !== null
        ? Math.max(liquidationDeltas.long, liquidationDeltas.short)
        : (liquidationDeltas.long ?? liquidationDeltas.short)
    if (dominant !== null && dominant >= LIQUIDATION_THRESHOLDS.medium) {
      events.push({
        ...base,
        type: 'LIQUIDATION_SPIKE',
        severity: severityForMagnitude(dominant, LIQUIDATION_THRESHOLDS),
        evidence: `Notional liquidado en el último minuto: $${dominant.toFixed(0)}.`,
        values: { liquidationLongDelta1m: liquidationDeltas.long, liquidationShortDelta1m: liquidationDeltas.short },
        previousValues: {},
      })
    }
  }

  if (previousLive) {
    const prevTotalDepth = (previousLive.bidDepth ?? 0) + (previousLive.askDepth ?? 0)
    const currTotalDepth = (state.bidDepth ?? 0) + (state.askDepth ?? 0)
    if (prevTotalDepth > 0) {
      const changePct = ((currTotalDepth - prevTotalDepth) / prevTotalDepth) * 100
      if (changePct <= -DEPTH_CHANGE_THRESHOLD_PCT) {
        events.push({
          ...base,
          type: 'LIQUIDITY_WITHDRAWAL',
          severity: 'MEDIUM',
          evidence: `Profundidad total del libro cayó ${changePct.toFixed(1)}% respecto a la lectura anterior.`,
          values: { bidDepth: state.bidDepth, askDepth: state.askDepth },
          previousValues: { bidDepth: previousLive.bidDepth, askDepth: previousLive.askDepth },
        })
      } else if (changePct >= DEPTH_CHANGE_THRESHOLD_PCT) {
        events.push({
          ...base,
          type: 'LIQUIDITY_INCREASE',
          severity: 'LOW',
          evidence: `Profundidad total del libro subió ${changePct.toFixed(1)}% respecto a la lectura anterior.`,
          values: { bidDepth: state.bidDepth, askDepth: state.askDepth },
          previousValues: { bidDepth: previousLive.bidDepth, askDepth: previousLive.askDepth },
        })
      }
    }

    if (previousLive.spread !== null && state.spread !== null && previousLive.spread > 0 && state.spread >= previousLive.spread * SPREAD_EXPANSION_MULTIPLE) {
      events.push({
        ...base,
        type: 'SPREAD_EXPANSION',
        severity: 'MEDIUM',
        evidence: `El spread pasó de ${previousLive.spread} a ${state.spread}.`,
        values: { spread: state.spread },
        previousValues: { spread: previousLive.spread },
      })
    }
  }

  const priceFlat = state.priceChange5m !== null && Math.abs(state.priceChange5m) < ABSORPTION_PRICE_FLAT_PCT
  const oiRising = state.openInterestChange5m !== null && state.openInterestChange5m > ABSORPTION_OI_RISING_PCT
  const cvdMoving = state.cvdDelta5m !== null && Math.abs(state.cvdDelta5m) > ABSORPTION_CVD_MOVING
  if (priceFlat && oiRising && cvdMoving) {
    events.push({
      ...base,
      type: 'ABSORPTION_CANDIDATE',
      severity: 'MEDIUM',
      evidence: 'Precio plano con interés abierto en expansión y flujo agresivo direccional — posible absorción.',
      values: {
        priceChange5m: state.priceChange5m,
        openInterestChange5m: state.openInterestChange5m,
        cvdDelta5m: state.cvdDelta5m,
      },
      previousValues: {},
    })
  }

  if (previousRegime && previousRegime !== 'UNKNOWN' && state.marketRegime !== 'UNKNOWN' && previousRegime !== state.marketRegime) {
    events.push({
      ...base,
      type: 'ORDERFLOW_REGIME_CHANGE',
      severity: 'MEDIUM',
      evidence: `Régimen cambió de ${previousRegime} a ${state.marketRegime}.`,
      values: { marketRegime: state.marketRegime },
      previousValues: { marketRegime: previousRegime },
    })
  }

  return events
}
