import type { RadarAsset } from '@/lib/oracle/types'

export interface RiskRegime {
  score: number
  label: string
  color: string
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function riskRegimeFromVix(vix: number | null): RiskRegime {
  if (vix === null) return { score: 50, label: 'Sin dato', color: 'text-ink-muted' }
  const score = clamp(Math.round(((45 - vix) / 35) * 100), 0, 100)
  if (score >= 70) return { score, label: 'Risk-On', color: 'text-atlas' }
  if (score <= 35) return { score, label: 'Risk-Off', color: 'text-bear' }
  return { score, label: 'Neutral', color: 'text-oracle' }
}

export interface AggregateBias {
  bullish: number
  bearish: number
  neutral: number
  avgScore: number
  label: 'Alcista' | 'Bajista' | 'Mixto'
  aligned: boolean
}

export function computeAggregateBias(radar: RadarAsset[]): AggregateBias | null {
  if (radar.length === 0) return null
  const bullish = radar.filter((a) => a.bias === 'long').length
  const bearish = radar.filter((a) => a.bias === 'short').length
  const neutral = radar.length - bullish - bearish
  const avgScore = radar.reduce((sum, a) => sum + a.totalScore, 0) / radar.length
  const label = bullish > bearish * 1.3 ? 'Alcista' : bearish > bullish * 1.3 ? 'Bajista' : 'Mixto'
  const dominant = Math.max(bullish, bearish, neutral)
  const aligned = dominant / radar.length >= 0.6
  return { bullish, bearish, neutral, avgScore, label, aligned }
}
