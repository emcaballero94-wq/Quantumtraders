import type { OptionsFlowBriefFacts, OptionsFlowLean } from './types'

// Mirrors lib/manu-gex/narrative.ts's status/keyChange split, but since this
// brief has no day-over-day snapshot to diff against, the lean comes
// straight from the score (same 60/40 thresholds the UI already uses to
// color the Pressure Score tile) rather than a regime-shift comparison.
export function deriveOptionsFlowLean(facts: OptionsFlowBriefFacts): OptionsFlowLean {
  if (facts.score >= 60) return 'BULLISH'
  if (facts.score <= 40) return 'BEARISH'
  return 'NEUTRAL'
}

function fmtNum(value: number | null, decimals = 2): string {
  return value === null || !Number.isFinite(value) ? 'sin dato' : value.toFixed(decimals)
}

function fmtUsd(value: number | null): string {
  if (value === null) return 'sin dato'
  return `$${Math.abs(value).toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 1 })}`
}

export function keyChangeText(facts: OptionsFlowBriefFacts): string {
  const lean = deriveOptionsFlowLean(facts)
  const leanText = lean === 'BULLISH' ? 'alcista' : lean === 'BEARISH' ? 'bajista' : 'neutral'
  return `Score ${facts.score}/100, presión ${leanText} (confianza ${facts.scoreConfidence}).`
}

// Deterministic fallback used when ANTHROPIC_API_KEY isn't configured, or
// the Claude call fails — never invents a number the caller didn't already
// compute.
export function buildDeterministicOptionsFlowNarrative(facts: OptionsFlowBriefFacts): string {
  const lean = deriveOptionsFlowLean(facts)
  const acc = facts.acceleration

  const lines = [
    'PRESIÓN',
    `Score ${facts.score}/100 (confianza ${facts.scoreConfidence}, datos ${facts.dataQuality === 'GOOD' ? 'OK' : 'limitados'}). Premium clasificado: ${fmtUsd(facts.bullishPremium)} alcista vs ${fmtUsd(facts.bearishPremium)} bajista, sobre ${facts.tradeCount} trades recientes.`,
    '',
    'OPERACIONES GRANDES',
    facts.largeTradeCount > 0
      ? `${facts.largeTradeCount} operaciones grandes detectadas (percentil 90). La más relevante: ${facts.topLargeTrades[0] ? `${facts.topLargeTrades[0].optionType} ${facts.topLargeTrades[0].side === 'BUY' ? 'compra' : 'venta'} en ${facts.topLargeTrades[0].strike.toLocaleString('en-US')} por ${fmtUsd(facts.topLargeTrades[0].premium)}.` : 'sin detalle.'}`
      : 'Sin operaciones grandes detectadas en la muestra actual.',
    '',
    'STRIKES CLAVE',
    facts.keyStrikes.length > 0
      ? `Capital concentrado en ${facts.keyStrikes.map((k) => `${k.strike.toLocaleString('en-US')} (${(k.shareOfTotalPremium * 100).toFixed(0)}%)`).join(', ')}. No es soporte o resistencia confirmado, solo dónde hay más premium operado.`
      : 'Sin concentración relevante por strike en la muestra actual.',
    '',
    'ACELERACIÓN',
    acc
      ? `Prima ${acc.trackedDirection === 'BULLISH' ? 'alcista' : 'bajista'} ${acc.direction === 'INCREASING' ? 'acelerando' : acc.direction === 'DECREASING' ? 'frenando' : 'estable'}${acc.magnitudePct !== null ? ` (${acc.magnitudePct >= 0 ? '+' : ''}${acc.magnitudePct.toFixed(0)}% vs los ${acc.windowMinutes} min previos)` : ''}.`
      : 'Sin base de comparación para aceleración todavía.',
    '',
    'INTERPRETACIÓN',
    `El flujo clasificado luce ${lean === 'BULLISH' ? 'alcista' : lean === 'BEARISH' ? 'bajista' : 'equilibrado'} por score, call/put ratio de ${fmtNum(facts.callPutRatio)} por prima.`,
    '',
    'RIESGO',
    `Ventana de hasta 1000 trades recientes de Deribit, no un histórico completo de sesión. La clasificación es por operación individual — no detecta spreads ni combos (ej. un call vendido puede ser parte de un calendar spread, no una apuesta bajista aislada).`,
  ]

  return lines.join('\n')
}
