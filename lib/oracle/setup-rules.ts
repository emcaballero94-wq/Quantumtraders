import type { Bias, RadarAsset } from '@/lib/oracle/types'

export interface SetupRuleResult {
  id: 'structure' | 'zone' | 'timing' | 'risk'
  label: string
  weight: number
  score: number
  passed: boolean
  evidence: string
}

export interface SetupConfluence {
  structure: boolean
  zone: boolean
  timing: boolean
  risk: boolean
  count: number
}

export interface SetupScoringResult {
  symbol: string
  score: number
  bias: Bias
  rules: SetupRuleResult[]
  riskReward: number | null
  confluence: SetupConfluence
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function scoreFromRange(value: number, good: number, warning: number): number {
  if (value <= good) return 100
  if (value <= warning) return 70
  return 35
}

function computeRiskReward(entry: number | null, stopLoss: number | null, takeProfit: number | null): number | null {
  if (entry === null || stopLoss === null || takeProfit === null) return null
  const risk = Math.abs(entry - stopLoss)
  const reward = Math.abs(takeProfit - entry)
  if (!Number.isFinite(risk) || !Number.isFinite(reward) || risk <= 0 || reward <= 0) return null
  return reward / risk
}

function scoreRiskRule(riskReward: number | null): number {
  if (riskReward === null) return 55
  if (riskReward >= 2) return 100
  if (riskReward >= 1.5) return 85
  if (riskReward >= 1.2) return 65
  return 30
}

export function scoreSetupFromAsset(input: {
  asset: RadarAsset
  entry?: number | null
  stopLoss?: number | null
  takeProfit?: number | null
}): SetupScoringResult {
  const entry = input.entry ?? null
  const stopLoss = input.stopLoss ?? null
  const takeProfit = input.takeProfit ?? null
  const riskReward = computeRiskReward(entry, stopLoss, takeProfit)

  const structureScore = clamp(input.asset.technicalScore, 0, 100)
  const structureRule: SetupRuleResult = {
    id: 'structure',
    label: 'Estructura (tendencia + técnico)',
    weight: 30,
    score: structureScore,
    passed: structureScore >= 65 && input.asset.trend !== 'sideways',
    evidence: `Técnico ${input.asset.technicalScore}, tendencia ${input.asset.trend}`,
  }

  const zoneScore = scoreFromRange(Math.abs(input.asset.change24h), 1.2, 2.0)
  const zoneRule: SetupRuleResult = {
    id: 'zone',
    label: 'Zona operable (extensión controlada)',
    weight: 25,
    score: zoneScore,
    passed: zoneScore >= 70,
    evidence: `Cambio diario ${input.asset.change24h.toFixed(2)}%`,
  }

  const timingScore = clamp(input.asset.timingScore, 0, 100)
  const timingRule: SetupRuleResult = {
    id: 'timing',
    label: 'Timing (sesión/kill-zone)',
    weight: 20,
    score: timingScore,
    passed: timingScore >= 60 || Boolean(input.asset.inKillZone),
    evidence: `Timing ${input.asset.timingScore}${input.asset.inKillZone ? ' con kill-zone activa' : ''}`,
  }

  const riskScore = scoreRiskRule(riskReward)
  const riskRule: SetupRuleResult = {
    id: 'risk',
    label: 'Riesgo (RR y control)',
    weight: 25,
    score: riskScore,
    passed: riskReward !== null ? riskReward >= 1.2 : input.asset.rating !== 'avoid',
    evidence: riskReward === null ? 'RR no definido (fallback por calidad del activo)' : `RR ${riskReward.toFixed(2)}`,
  }

  const rules = [structureRule, zoneRule, timingRule, riskRule]
  const score = Math.round(
    rules.reduce((acc, rule) => acc + (rule.score * rule.weight) / 100, 0),
  )

  const confluence: SetupConfluence = {
    structure: structureRule.passed,
    zone: zoneRule.passed,
    timing: timingRule.passed,
    risk: riskRule.passed,
    count: [structureRule, zoneRule, timingRule, riskRule].filter((rule) => rule.passed).length,
  }

  return {
    symbol: input.asset.symbol,
    score: clamp(score, 0, 100),
    bias: input.asset.bias,
    rules,
    riskReward,
    confluence,
  }
}
