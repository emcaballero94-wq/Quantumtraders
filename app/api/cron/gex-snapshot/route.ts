import { NextResponse } from 'next/server'
import { rejectIfNotCron } from '@/lib/server/endpoint-guards'
import { fetchGexMatrixInput, type GexAssetClass } from '@/lib/gex/fetch-matrix-input'
import { computeGexMatrix } from '@/lib/gex/matrix'
import { upsertGexSnapshot } from '@/lib/gex/snapshot-persistence'

const EXPIRATIONS_PER_SYMBOL = 8

// Small, fixed watchlist — keeps the daily API call volume to Tradier/Deribit
// bounded and predictable instead of snapshotting every symbol a user might
// ever look at. SPY/QQQ/GLD are the equity names public GEX tools track most
// (broad market + the metal play from the XAUUSD work); BTC/ETH cover crypto.
const WATCHLIST: Array<{ assetClass: GexAssetClass; symbol: string }> = [
  { assetClass: 'equity', symbol: 'SPY' },
  { assetClass: 'equity', symbol: 'QQQ' },
  { assetClass: 'equity', symbol: 'GLD' },
  { assetClass: 'crypto', symbol: 'BTC' },
  { assetClass: 'crypto', symbol: 'ETH' },
]

// Triggered once a day by Vercel Cron (see vercel.json). Snapshots the
// current GEX matrix for a fixed watchlist so the GEX page can eventually
// show a day-over-day comparison and replay past days — see the comment on
// quantumtraders.gex_snapshots in supabase/schema.sql for why this needs to
// be persisted at all (the live /api/market/gex[-matrix] endpoints have no
// memory of prior sessions).
export async function GET(request: Request) {
  const blocked = rejectIfNotCron(request)
  if (blocked) return blocked

  const snapshotDate = new Date().toISOString().slice(0, 10)
  const results = await Promise.all(
    WATCHLIST.map(async ({ assetClass, symbol }) => {
      try {
        const { underlyingPrice, perExpiration } = await fetchGexMatrixInput(assetClass, symbol, EXPIRATIONS_PER_SYMBOL)
        if (underlyingPrice === null || perExpiration.length === 0) {
          return { assetClass, symbol, success: false, error: 'No data available' }
        }

        const matrix = computeGexMatrix(perExpiration, underlyingPrice)
        const outcome = await upsertGexSnapshot({ assetClass, symbol, snapshotDate, matrix })
        return { assetClass, symbol, ...outcome }
      } catch (error) {
        console.error(`[/api/cron/gex-snapshot] ${assetClass}:${symbol} failed:`, error)
        return { assetClass, symbol, success: false, error: 'Unexpected error' }
      }
    }),
  )

  return NextResponse.json({ snapshotDate, results })
}
