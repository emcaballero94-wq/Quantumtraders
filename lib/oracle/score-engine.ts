import type { Bias, Rating, Trend, OracleScore, RadarAsset } from './types'
import { clamp } from './indicators'

// ─── Score Formula ───────────────────────────────────────────
// Total = 40% Macro + 45% Technical + 15% Timing

const WEIGHTS = { macro: 0.40, technical: 0.45, timing: 0.15 } as const

// ─── Helpers ─────────────────────────────────────────────────

function computeTotal(macro: number, technical: number, timing: number): number {
  return clamp(Math.round(
    macro     * WEIGHTS.macro     +
    technical * WEIGHTS.technical +
    timing    * WEIGHTS.timing,
  ))
}

function deriveRating(score: number): Rating {
  if (score >= 70) return 'strong'
  if (score >= 50) return 'operable'
  if (score >= 30) return 'mixed'
  return 'avoid'
}

function deriveBias(macro: number, technical: number): Bias {
  const combined = macro * 0.40 + technical * 0.60
  if (combined >= 60) return 'long'
  if (combined <= 40) return 'short'
  return 'neutral'
}

function buildRecommendation(score: number, bias: Bias, rating: Rating): string {
  if (rating === 'strong' && bias === 'long')
    return 'Setup alcista de alta calidad — priorizar entradas long en correcciones'
  if (rating === 'strong' && bias === 'short')
    return 'Setup bajista de alta calidad — priorizar entradas short en rebotes'
  if (rating === 'operable' && bias === 'long')
    return 'Condiciones operables para longs — gestionar riesgo con precaución'
  if (rating === 'operable' && bias === 'short')
    return 'Condiciones operables para shorts — gestionar riesgo con precaución'
  if (rating === 'mixed')
    return 'Señales mixtas — reducir tamaño de posición o esperar confirmación'
  return 'Condiciones desfavorables — evitar operar este activo ahora'
}

// ─── Main Score Engine ───────────────────────────────────────

export interface ScoreInputs {
  symbol:         string
  macroScore:     number
  technicalScore: number
  timingScore:    number
  trend?:         Trend
}

export function computeOracleScore(inputs: ScoreInputs): OracleScore {
  const { symbol, macroScore, technicalScore, timingScore, trend = 'sideways' } = inputs

  const totalScore = computeTotal(macroScore, technicalScore, timingScore)
  const bias       = deriveBias(macroScore, technicalScore)
  const rating     = deriveRating(totalScore)

  return {
    symbol,
    totalScore,
    macroScore,
    technicalScore,
    timingScore,
    bias,
    rating,
    trend,
    recommendation: buildRecommendation(totalScore, bias, rating),
    updatedAt:      new Date().toISOString(),
  }
}

// ─── Rank Assets ─────────────────────────────────────────────

export function rankAssets(assets: RadarAsset[]): RadarAsset[] {
  return [...assets].sort((a, b) => b.totalScore - a.totalScore)
}

// ─── Get Top Opportunity ─────────────────────────────────────

export function getTopOpportunity(assets: RadarAsset[]): RadarAsset | null {
  const operables = assets.filter(
    (a) => a.rating === 'strong' || a.rating === 'operable',
  )
  if (operables.length === 0) return null
  return rankAssets(operables)[0] ?? null
}

// ─── Score Label Helpers (for UI) ────────────────────────────

export function scoreToColor(score: number): string {
  if (score >= 70) return '#00C9A7'   // atlas green — strong
  if (score >= 50) return '#3B82F6'   // blue — operable
  if (score >= 30) return '#F59E0B'   // amber — mixed
  return '#EF4444'                    // red — avoid
}

export function ratingToColor(rating: Rating): string {
  switch (rating) {
    case 'strong':   return '#00C9A7'
    case 'operable': return '#3B82F6'
    case 'mixed':    return '#F59E0B'
    case 'avoid':    return '#EF4444'
  }
}

export function biasToColor(bias: Bias): string {
  switch (bias) {
    case 'long':    return '#00C9A7'
    case 'short':   return '#EF4444'
    case 'neutral': return '#8892A4'
  }
}

export function biasLabel(bias: Bias): string {
  switch (bias) {
    case 'long':    return 'ALCISTA'
    case 'short':   return 'BAJISTA'
    case 'neutral': return 'NEUTRAL'
  }
}

export function ratingLabel(rating: Rating): string {
  switch (rating) {
    case 'strong':   return 'STRONG'
    case 'operable': return 'OPERABLE'
    case 'mixed':    return 'MIXED'
    case 'avoid':    return 'AVOID'
  }
}
