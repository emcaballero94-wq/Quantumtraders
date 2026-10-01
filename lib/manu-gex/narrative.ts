import type { GexBriefFacts } from './types'

export type GexStatus = 'STABLE' | 'REGIME_SHIFT' | 'NO_HISTORY'

// Unlike Order Flow's status (driven by detected events of varying
// severity), GEX only has one real day-over-day signal worth flagging: did
// the dealer gamma regime flip sign since the last snapshot.
export function deriveGexStatus(facts: GexBriefFacts): GexStatus {
  if (!facts.dayOverDay) return 'NO_HISTORY'
  const shift = facts.dayOverDay.regimeShift
  return shift === 'FLIPPED_TO_POSITIVE' || shift === 'FLIPPED_TO_NEGATIVE' ? 'REGIME_SHIFT' : 'STABLE'
}

export function keyChangeText(facts: GexBriefFacts): string {
  const d = facts.dayOverDay
  if (!d) return 'Sin snapshot previo para comparar todavía — esta es la primera lectura registrada.'
  if (d.regimeShift === 'FLIPPED_TO_POSITIVE') return `El régimen de gamma pasó de negativo (${d.priorDate}) a positivo hoy.`
  if (d.regimeShift === 'FLIPPED_TO_NEGATIVE') return `El régimen de gamma pasó de positivo (${d.priorDate}) a negativo hoy.`
  return `Régimen de gamma sin cambios desde ${d.priorDate} (sigue ${facts.regime === 'POSITIVE' ? 'positivo' : 'negativo'}).`
}

function fmtNum(value: number | null, decimals = 2): string {
  return value === null || !Number.isFinite(value) ? 'sin dato' : value.toFixed(decimals)
}

// Deterministic fallback used when ANTHROPIC_API_KEY isn't configured —
// never invents a number the caller didn't already compute.
export function buildDeterministicGexNarrative(facts: GexBriefFacts): string {
  const d = facts.dayOverDay
  const lines = [
    'RÉGIMEN',
    `Net GEX: ${fmtNum(facts.netGex, 0)} (${facts.regime === 'POSITIVE' ? 'positivo' : 'negativo'}). ${facts.contractsWithGamma}/${facts.totalContracts} contratos con gamma calculable.`,
    '',
    'NIVELES',
    `Call wall: ${fmtNum(facts.callWallStrike)}. Put wall: ${fmtNum(facts.putWallStrike)}. Gamma flip: ${fmtNum(facts.gammaFlip)}. Max pain: ${fmtNum(facts.maxPainStrike)}.`,
    '',
    'CAMBIO VS. SESIÓN ANTERIOR',
    d
      ? `${d.priorDate}: net GEX ${fmtNum(d.priorNetGex, 0)}, call wall ${fmtNum(d.priorCallWallStrike)}, put wall ${fmtNum(d.priorPutWallStrike)}. Cambio: ${fmtNum(d.netGexChangePct, 1)}%.`
      : 'Sin snapshot previo todavía.',
    '',
    'FLUJO DE OPCIONES',
    `Put/Call volumen: ${fmtNum(facts.chain.putCallVolumeRatio, 2)}. Put/Call open interest: ${fmtNum(facts.chain.putCallOpenInterestRatio, 2)}. Skew de IV (put - call): ${facts.chain.ivSkew !== null ? `${(facts.chain.ivSkew * 100).toFixed(2)}pp` : 'sin dato'}.`,
  ]

  return lines.join('\n')
}
