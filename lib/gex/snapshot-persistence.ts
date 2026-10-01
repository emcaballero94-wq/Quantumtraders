import { createAdminClient } from '@/lib/supabase/admin'
import type { GexMatrixResult } from './matrix'

export type GexSnapshotAssetClass = 'equity' | 'crypto'

export interface GexSnapshotRecord {
  id: string
  assetClass: GexSnapshotAssetClass
  symbol: string
  snapshotDate: string
  underlyingPrice: number
  netGex: number
  callWallStrike: number | null
  putWallStrike: number | null
  gammaFlip: number | null
  matrix: GexMatrixResult
  capturedAt: string
}

interface GexSnapshotRow {
  id: string
  asset_class: GexSnapshotAssetClass
  symbol: string
  snapshot_date: string
  underlying_price: number
  net_gex: number
  call_wall_strike: number | null
  put_wall_strike: number | null
  gamma_flip: number | null
  matrix: GexMatrixResult
  captured_at: string
}

const SELECT_COLUMNS =
  'id, asset_class, symbol, snapshot_date, underlying_price, net_gex, call_wall_strike, put_wall_strike, gamma_flip, matrix, captured_at'

function mapRow(row: GexSnapshotRow): GexSnapshotRecord {
  return {
    id: row.id,
    assetClass: row.asset_class,
    symbol: row.symbol,
    snapshotDate: row.snapshot_date,
    underlyingPrice: row.underlying_price,
    netGex: row.net_gex,
    callWallStrike: row.call_wall_strike,
    putWallStrike: row.put_wall_strike,
    gammaFlip: row.gamma_flip,
    matrix: row.matrix,
    capturedAt: row.captured_at,
  }
}

// One snapshot per (assetClass, symbol, snapshotDate) — re-running the cron
// job for a date that already has a row overwrites it instead of duplicating,
// so a retried or manually re-triggered run is always safe.
export async function upsertGexSnapshot(input: {
  assetClass: GexSnapshotAssetClass
  symbol: string
  snapshotDate: string
  matrix: GexMatrixResult
}): Promise<{ success: boolean; error?: string }> {
  const admin = createAdminClient()
  if (!admin) return { success: false, error: 'Supabase admin client not configured' }

  const { error } = await admin.from('gex_snapshots').upsert(
    {
      asset_class: input.assetClass,
      symbol: input.symbol,
      snapshot_date: input.snapshotDate,
      underlying_price: input.matrix.underlyingPrice,
      net_gex: input.matrix.aggregate.netGex,
      call_wall_strike: input.matrix.aggregate.callWallStrike,
      put_wall_strike: input.matrix.aggregate.putWallStrike,
      gamma_flip: input.matrix.aggregate.gammaFlip,
      matrix: input.matrix,
    },
    { onConflict: 'asset_class,symbol,snapshot_date' },
  )

  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function getGexSnapshot(
  assetClass: GexSnapshotAssetClass,
  symbol: string,
  snapshotDate: string,
): Promise<GexSnapshotRecord | null> {
  const admin = createAdminClient()
  if (!admin) return null

  const { data, error } = await admin
    .from('gex_snapshots')
    .select(SELECT_COLUMNS)
    .eq('asset_class', assetClass)
    .eq('symbol', symbol)
    .eq('snapshot_date', snapshotDate)
    .maybeSingle()

  if (error || !data) return null
  return mapRow(data as GexSnapshotRow)
}

// Most recent snapshots first — used both to list available "replay" dates
// for a symbol and to find the latest prior session for a day-over-day diff.
export async function listGexSnapshots(
  assetClass: GexSnapshotAssetClass,
  symbol: string,
  limit = 30,
): Promise<GexSnapshotRecord[]> {
  const admin = createAdminClient()
  if (!admin) return []

  const { data, error } = await admin
    .from('gex_snapshots')
    .select(SELECT_COLUMNS)
    .eq('asset_class', assetClass)
    .eq('symbol', symbol)
    .order('snapshot_date', { ascending: false })
    .limit(limit)

  if (error || !data) return []
  return (data as GexSnapshotRow[]).map(mapRow)
}
