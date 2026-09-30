import type { OrderFlowBriefRecord } from '@/lib/oracle/orderflow-persistence'

const MINUTE_MS = 60 * 1000
const HOUR_MS = 60 * MINUTE_MS
// "Memoria intradía" — no un backtest de largo plazo. Si alguien pide algo
// más viejo que esto, igual se recorta a esta ventana.
const MAX_LOOKBACK_MS = 3 * 24 * HOUR_MS
const MAX_BUCKETS = 12

export interface TimeWindow {
  since: Date
  label: string
}

// Extrae de una pregunta en español (ej. "¿cómo evolucionó el flujo desde
// las 08:00?") la ventana de tiempo a consultar. Deliberadamente simple
// (regex, no un LLM): determinista, gratis, y suficiente para las formas en
// que alguien realmente pregunta esto. Todas las horas se interpretan en UTC,
// igual que el resto del dashboard de Order Flow.
export function parseTimeWindow(question: string, now: Date = new Date()): TimeWindow {
  const q = question.toLowerCase()

  const clockMatch = q.match(/desde\s+las?\s*(\d{1,2})(?::(\d{2}))?/)
  if (clockMatch) {
    const hours = Number.parseInt(clockMatch[1], 10)
    const minutes = clockMatch[2] ? Number.parseInt(clockMatch[2], 10) : 0
    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      const candidate = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hours, minutes, 0, 0),
      )
      const since = candidate.getTime() > now.getTime() ? new Date(candidate.getTime() - 24 * HOUR_MS) : candidate
      return {
        since,
        label: `desde las ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')} UTC`,
      }
    }
  }

  const hoursMatch = q.match(/(?:[uú]ltimas?)\s*(\d+)\s*(?:horas?|hrs?|h\b)/)
  if (hoursMatch) {
    const hours = Number.parseInt(hoursMatch[1], 10)
    if (hours > 0) return { since: new Date(now.getTime() - hours * HOUR_MS), label: `las últimas ${hours}h` }
  }

  if (/[uú]ltima\s+hora/.test(q)) {
    return { since: new Date(now.getTime() - HOUR_MS), label: 'la última hora' }
  }

  const minutesMatch = q.match(/(?:[uú]ltimos?)\s*(\d+)\s*min/)
  if (minutesMatch) {
    const minutes = Number.parseInt(minutesMatch[1], 10)
    if (minutes > 0) return { since: new Date(now.getTime() - minutes * MINUTE_MS), label: `los últimos ${minutes}min` }
  }

  if (/\bhoy\b/.test(q)) {
    const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0))
    return { since, label: 'hoy (00:00 UTC)' }
  }

  return { since: new Date(now.getTime() - 4 * HOUR_MS), label: 'las últimas 4h (ventana por defecto)' }
}

export function clampSince(since: Date, now: Date): Date {
  const minAllowed = new Date(now.getTime() - MAX_LOOKBACK_MS)
  return since.getTime() < minAllowed.getTime() ? minAllowed : since
}

export interface FlowBucket {
  startLabel: string
  endLabel: string
  priceStart: number | null
  priceEnd: number | null
  priceChangePct: number | null
  cvdStart: number | null
  cvdEnd: number | null
  avgBookImbalance: number | null
  avgFundingRate: number | null
  bias: 'bullish' | 'bearish' | 'neutral'
}

function sign(value: number | null): number {
  if (value === null || !Number.isFinite(value)) return 0
  if (value > 0) return 1
  if (value < 0) return -1
  return 0
}

function average(values: number[]): number | null {
  return values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : null
}

function formatUtcTime(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
}

// Downsamples the raw records (one per generated brief, ~every 60s) into a
// handful of time buckets so the LLM gets a readable timeline instead of
// hundreds of near-duplicate rows. Bias per bucket reuses the same
// sign-summing approach as the backtest endpoint, applied to the bucket's
// own price/CVD/imbalance movement rather than a single point-in-time read.
export function buildFlowTimeline(records: OrderFlowBriefRecord[]): FlowBucket[] {
  if (records.length === 0) return []

  const bucketCount = Math.max(1, Math.min(MAX_BUCKETS, Math.ceil(records.length / 3)))
  const bucketSize = Math.ceil(records.length / bucketCount)

  const buckets: FlowBucket[] = []
  for (let i = 0; i < records.length; i += bucketSize) {
    const slice = records.slice(i, i + bucketSize)
    if (slice.length === 0) continue

    const first = slice[0]
    const last = slice[slice.length - 1]

    const priceChangePct =
      first.price !== null && last.price !== null && first.price !== 0
        ? ((last.price - first.price) / first.price) * 100
        : null

    const avgBookImbalance = average(slice.map((r) => r.bookImbalance).filter((v): v is number => v !== null))
    const avgFundingRate = average(slice.map((r) => r.fundingRate).filter((v): v is number => v !== null))

    const cvdDelta = first.cvd !== null && last.cvd !== null ? last.cvd - first.cvd : null
    const score = sign(priceChangePct) + sign(avgBookImbalance) + sign(cvdDelta)
    const bias: FlowBucket['bias'] = score > 0 ? 'bullish' : score < 0 ? 'bearish' : 'neutral'

    buckets.push({
      startLabel: formatUtcTime(first.createdAt),
      endLabel: formatUtcTime(last.createdAt),
      priceStart: first.price,
      priceEnd: last.price,
      priceChangePct,
      cvdStart: first.cvd,
      cvdEnd: last.cvd,
      avgBookImbalance,
      avgFundingRate,
      bias,
    })
  }

  return buckets
}
