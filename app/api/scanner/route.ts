import { NextResponse } from 'next/server'
import { fetchMarketHistory, resampleCandles } from '@/lib/market-data'
import { rejectIfRateLimited } from '@/lib/server/endpoint-guards'
import { withApiCache } from '@/lib/server/api-cache'
import {
  evaluateConditions,
  SCANNER_ASSETS,
  SCANNER_TIMEFRAMES,
  TIMEFRAME_SOURCE,
  CONDITION_LABEL,
  type ScannerAsset,
  type ScannerCondition,
  type ScannerTimeframe,
} from '@/lib/scanner/conditions'

const RANGE_BY_TIMEFRAME: Record<ScannerTimeframe, string> = {
  M5: '5d',
  M15: '5d',
  H1: '1mo',
  H4: '3mo',
  D1: '1y',
}

export async function GET(request: Request) {
  const blocked = rejectIfRateLimited(request, {
    routeKey: 'market-scanner',
    limit: 30,
    windowMs: 60_000,
  })
  if (blocked) return blocked

  const { searchParams } = new URL(request.url)
  const assetsParam = searchParams.get('assets')
  const conditionsParam = searchParams.get('conditions')
  const timeframeParam = (searchParams.get('timeframe') ?? 'H1').toUpperCase()

  const timeframe = (SCANNER_TIMEFRAMES as readonly string[]).includes(timeframeParam)
    ? (timeframeParam as ScannerTimeframe)
    : 'H1'

  const requestedAssets = assetsParam
    ? assetsParam.split(',').map((s) => s.trim().toUpperCase()).filter((s) => (SCANNER_ASSETS as readonly string[]).includes(s)) as ScannerAsset[]
    : [...SCANNER_ASSETS]

  const requestedConditions = conditionsParam
    ? conditionsParam.split(',').map((s) => s.trim()).filter((s) => Object.keys(CONDITION_LABEL).includes(s)) as ScannerCondition[]
    : []

  const { interval, resampleChunk } = TIMEFRAME_SOURCE[timeframe]
  const range = RANGE_BY_TIMEFRAME[timeframe]

  const results = await Promise.all(
    requestedAssets.map(async (asset) => {
      try {
        const candles = await withApiCache(
          `scanner:${asset}:${interval}:${range}`,
          60_000,
          () => fetchMarketHistory(asset, { interval, range }),
        )
        const effective = resampleChunk > 1 ? resampleCandles(candles, resampleChunk) : candles
        if (effective.length < 30) return { asset, error: 'Not enough history' as const }

        const evaluation = evaluateConditions(effective)
        return { asset, evaluation, lastClose: effective[effective.length - 1]?.close ?? null }
      } catch (err) {
        console.error(`[/api/scanner] Failed for ${asset}:`, err)
        return { asset, error: 'Fetch failed' as const }
      }
    }),
  )

  const rows = results.flatMap((result) => {
    if ('error' in result) return []
    const { asset, evaluation, lastClose } = result

    const relevantMatches = requestedConditions.length > 0
      ? evaluation.matches.filter((m) => requestedConditions.includes(m.condition))
      : evaluation.matches

    if (requestedConditions.length > 0 && relevantMatches.length === 0) return []

    const primary = relevantMatches[0] ?? evaluation.matches[0] ?? null

    return [{
      asset,
      setup: primary ? CONDITION_LABEL[primary.condition] : 'No signal',
      detail: primary?.detail ?? 'No condition met on this timeframe right now',
      timeframe,
      volatility: evaluation.volatility,
      trend: evaluation.trend,
      lastClose,
      signal: relevantMatches.length > 0 ? 'Detected' : 'Watching',
      matchedConditions: relevantMatches.map((m) => m.condition),
    }]
  })

  const failures = results
    .filter((r) => 'error' in r)
    .map((r) => ({ asset: r.asset, error: (r as { error: string }).error }))

  return NextResponse.json({ success: true, timeframe, rows, failures })
}
