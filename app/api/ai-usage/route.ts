import { NextResponse } from 'next/server'
import { getAiUsageSummary, type AiUsageSummary } from '@/lib/ai-usage/usage-log'

function startOfTodayUtcIso(): string {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString()
}

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
}

interface UsageTotal {
  callCount: number
  inputTokens: number
  outputTokens: number
  costUsd: number
}

function totalOf(rows: AiUsageSummary[]): UsageTotal {
  return rows.reduce(
    (acc, r) => ({
      callCount: acc.callCount + r.callCount,
      inputTokens: acc.inputTokens + r.inputTokens,
      outputTokens: acc.outputTokens + r.outputTokens,
      costUsd: acc.costUsd + r.costUsd,
    }),
    { callCount: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 },
  )
}

export async function GET() {
  const [today, last7d, last30d] = await Promise.all([
    getAiUsageSummary(startOfTodayUtcIso()),
    getAiUsageSummary(daysAgoIso(7)),
    getAiUsageSummary(daysAgoIso(30)),
  ])

  return NextResponse.json({
    success: true,
    data: {
      today: { total: totalOf(today), byRoute: today },
      last7d: { total: totalOf(last7d), byRoute: last7d },
      last30d: { total: totalOf(last30d), byRoute: last30d },
    },
  })
}
