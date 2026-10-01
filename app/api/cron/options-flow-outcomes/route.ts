import { NextResponse } from 'next/server'
import { rejectIfNotCron } from '@/lib/server/endpoint-guards'
import { listOptionsFlowBriefsOlderThan } from '@/lib/manu-options-flow/brief-persistence'
import { insertBriefOutcome, OUTCOME_HORIZON_HOURS } from '@/lib/manu-options-flow/outcome-persistence'
import { computeOutcome } from '@/lib/manu-options-flow/outcome-tracking'
import { fetchMarketQuotes } from '@/lib/market-data'
import type { CryptoCurrency } from '@/lib/manu/crypto-symbol-mapping'

const ENGINE = 'options_flow'
const CURRENCIES: CryptoCurrency[] = ['BTC', 'ETH']
const SPOT_QUOTE_SYMBOL: Record<CryptoCurrency, string> = { BTC: 'BTCUSD', ETH: 'ETHUSD' }
const MAX_BRIEFS_PER_CURRENCY = 50

// Triggered once a day by Vercel Cron (see vercel.json). Scores every
// options_flow_briefs row old enough to have reached the 24h horizon: did
// price actually move the way the brief's lean said it would? Skips (rather
// than guesses) any brief or currency missing the spot price it needs —
// never invents a number to fill the gap. Idempotent: re-running over an
// already-scored brief is a no-op (unique constraint + ignoreDuplicates in
// insertBriefOutcome).
export async function GET(request: Request) {
  const blocked = rejectIfNotCron(request)
  if (blocked) return blocked

  const cutoffIso = new Date(Date.now() - OUTCOME_HORIZON_HOURS * 60 * 60 * 1000).toISOString()

  const results = await Promise.all(
    CURRENCIES.map(async (currency) => {
      try {
        const [briefs, quote] = await Promise.all([
          listOptionsFlowBriefsOlderThan(currency, cutoffIso, MAX_BRIEFS_PER_CURRENCY),
          fetchMarketQuotes([SPOT_QUOTE_SYMBOL[currency]]).then((qs) => qs[0] ?? null),
        ])

        const priceAtOutcome = quote?.price ?? null
        if (priceAtOutcome === null) {
          return { currency, candidates: briefs.length, scored: 0, skipped: briefs.length, reason: 'no current spot price' }
        }

        let scored = 0
        let skipped = 0
        for (const brief of briefs) {
          const priceAtBrief = brief.facts.underlyingPriceUsd
          if (priceAtBrief === null) {
            skipped++
            continue
          }

          const outcome = computeOutcome(brief.lean, priceAtBrief, priceAtOutcome)
          await insertBriefOutcome({
            engine: ENGINE,
            briefId: brief.id,
            symbol: currency,
            lean: brief.lean,
            priceAtBrief,
            briefCreatedAt: brief.createdAt,
            horizonHours: OUTCOME_HORIZON_HOURS,
            priceAtOutcome,
            priceChangePct: outcome.priceChangePct,
            actualDirection: outcome.actualDirection,
            correct: outcome.correct,
          })
          scored++
        }

        return { currency, candidates: briefs.length, scored, skipped }
      } catch (error) {
        console.error(`[/api/cron/options-flow-outcomes] ${currency} failed:`, error)
        return { currency, success: false, error: 'Unexpected error' }
      }
    }),
  )

  return NextResponse.json({ cutoffIso, results })
}
