import type { MarketState, RelationshipObservation } from './types'

// Noise floors for calling a direction "up/down" vs "flat" when reading
// relationships between variables — deliberately a bit wider than the
// change-detection noise thresholds, since a relationship should only fire
// on a move that's actually visible, not any nonzero delta.
const PRICE_NOISE_PCT = 0.03
const CVD_NOISE = 0.5
const OI_NOISE_PCT = 0.1
const FUNDING_OVERHEATED_THRESHOLD = 0.0003

type Direction = 'up' | 'down' | 'flat'

function priceDirection(state: MarketState): Direction {
  if (state.priceChange5m === null) return 'flat'
  if (state.priceChange5m > PRICE_NOISE_PCT) return 'up'
  if (state.priceChange5m < -PRICE_NOISE_PCT) return 'down'
  return 'flat'
}

function cvdDirection(state: MarketState): Direction {
  if (state.cvdDelta5m === null) return 'flat'
  if (state.cvdDelta5m > CVD_NOISE) return 'up'
  if (state.cvdDelta5m < -CVD_NOISE) return 'down'
  return 'flat'
}

function oiDirection(state: MarketState): Direction {
  if (state.openInterestChange5m === null) return 'flat'
  if (state.openInterestChange5m > OI_NOISE_PCT) return 'up'
  if (state.openInterestChange5m < -OI_NOISE_PCT) return 'down'
  return 'flat'
}

// Observations describe microstructure, never a trade call. Nothing here
// ever resolves to BUY/SELL/LONG/SHORT — see section 8 of the M.A.N.U. spec.
export function buildRelationships(state: MarketState): RelationshipObservation[] {
  const observations: RelationshipObservation[] = []
  const price = priceDirection(state)
  const cvd = cvdDirection(state)
  const oi = oiDirection(state)

  if (state.priceChange5m !== null && state.cvdDelta5m !== null) {
    if (price === 'up' && cvd === 'up') {
      observations.push({
        pair: 'PRICE+CVD',
        observation: 'demand confirmation',
        detail: 'El precio sube y el flujo agresivo comprador lo respalda.',
      })
    } else if (price === 'up' && cvd === 'down') {
      observations.push({
        pair: 'PRICE+CVD',
        observation: 'divergence',
        detail: 'El precio sube pero el CVD cae — la subida no está confirmada por flujo agresivo comprador.',
      })
    } else if (price === 'down' && cvd === 'down') {
      observations.push({
        pair: 'PRICE+CVD',
        observation: 'supply confirmation',
        detail: 'El precio baja y el flujo agresivo vendedor lo respalda.',
      })
    } else if (price === 'down' && cvd === 'up') {
      observations.push({
        pair: 'PRICE+CVD',
        observation: 'divergence',
        detail: 'El precio baja pero el CVD sube — la caída no está confirmada por flujo agresivo vendedor.',
      })
    }
  }

  if (state.priceChange5m !== null && state.openInterestChange5m !== null) {
    if (price === 'up' && oi === 'up') {
      observations.push({
        pair: 'PRICE+OI',
        observation: 'exposure expansion',
        detail: 'Sube el precio y crece el interés abierto — se están abriendo posiciones nuevas.',
      })
    } else if (price === 'up' && oi === 'down') {
      observations.push({
        pair: 'PRICE+OI',
        observation: 'possible short covering',
        detail: 'Sube el precio mientras el interés abierto cae — contexto de posible cierre de cortos, no confirmado.',
      })
    } else if (price === 'down' && oi === 'up') {
      observations.push({
        pair: 'PRICE+OI',
        observation: 'exposure expansion',
        detail: 'Baja el precio y crece el interés abierto — se están abriendo posiciones nuevas en la caída.',
      })
    } else if (price === 'down' && oi === 'down') {
      observations.push({
        pair: 'PRICE+OI',
        observation: 'possible long unwind',
        detail: 'Baja el precio mientras el interés abierto cae — contexto de posible cierre de largos, no confirmado.',
      })
    }
  }

  if (price === 'flat' && cvd !== 'flat' && oi === 'up') {
    observations.push({
      pair: 'PRICE+CVD+OI',
      observation: 'potential absorption / positioning event',
      detail: 'El precio se mantiene plano mientras hay flujo agresivo direccional y el interés abierto crece — posible absorción.',
    })
  }

  if (state.liquidationLong !== null && state.liquidationShort !== null && price !== 'flat') {
    if (state.liquidationLong > state.liquidationShort) {
      observations.push({
        pair: 'PRICE+LIQUIDATIONS',
        observation: 'long liquidation pressure context',
        detail: `Predominan liquidaciones de largos junto con un movimiento de precio ${price === 'up' ? 'al alza' : 'a la baja'}.`,
      })
    } else if (state.liquidationShort > state.liquidationLong) {
      observations.push({
        pair: 'PRICE+LIQUIDATIONS',
        observation: 'short liquidation pressure context',
        detail: `Predominan liquidaciones de cortos junto con un movimiento de precio ${price === 'up' ? 'al alza' : 'a la baja'}.`,
      })
    }
  }

  if (state.funding !== null) {
    if (state.funding > FUNDING_OVERHEATED_THRESHOLD && price === 'up') {
      observations.push({
        pair: 'PRICE+FUNDING',
        observation: 'overheated long side',
        detail: 'El funding está elevado mientras el precio sube — el lado largo paga una prima creciente.',
      })
    } else if (state.funding < -FUNDING_OVERHEATED_THRESHOLD && price === 'down') {
      observations.push({
        pair: 'PRICE+FUNDING',
        observation: 'overheated short side',
        detail: 'El funding está negativo y elevado mientras el precio baja — el lado corto paga una prima creciente.',
      })
    }
  }

  if (state.orderBookImbalance !== null) {
    if (state.orderBookImbalance > 0 && price === 'down') {
      observations.push({
        pair: 'ORDERBOOK+PRICE',
        observation: 'bid support without follow-through',
        detail: 'El libro muestra más profundidad compradora, pero el precio no ha logrado subir.',
      })
    } else if (state.orderBookImbalance < 0 && price === 'up') {
      observations.push({
        pair: 'ORDERBOOK+PRICE',
        observation: 'ask resistance without follow-through',
        detail: 'El libro muestra más profundidad vendedora, pero el precio no ha logrado bajar.',
      })
    }
  }

  return observations
}

export function detectPriceCvdDivergence(state: MarketState): boolean {
  if (state.priceChange5m === null || state.cvdDelta5m === null) return false
  const price = priceDirection(state)
  const cvd = cvdDirection(state)
  return (price === 'up' && cvd === 'down') || (price === 'down' && cvd === 'up')
}
