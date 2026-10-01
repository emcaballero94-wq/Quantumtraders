import { createAdminClient } from '@/lib/supabase/admin'
import type { GexBriefFacts } from './types'
import type { GexStatus } from './narrative'

export interface GexBriefRecord {
  id: string
  assetClass: 'equity' | 'crypto'
  symbol: string
  status: GexStatus
  keyChange: string
  narrative: string
  narrativeSource: 'ai' | 'deterministic'
  facts: GexBriefFacts
  createdAt: string
}

interface GexBriefRow {
  id: string
  asset_class: 'equity' | 'crypto'
  symbol: string
  status: GexStatus
  key_change: string
  narrative: string
  narrative_source: 'ai' | 'deterministic'
  facts: GexBriefFacts
  created_at: string
}

const SELECT_COLUMNS = 'id, asset_class, symbol, status, key_change, narrative, narrative_source, facts, created_at'

function mapRow(row: GexBriefRow): GexBriefRecord {
  return {
    id: row.id,
    assetClass: row.asset_class,
    symbol: row.symbol,
    status: row.status,
    keyChange: row.key_change,
    narrative: row.narrative,
    narrativeSource: row.narrative_source,
    facts: row.facts,
    createdAt: row.created_at,
  }
}

// Fire-and-forget from the caller's perspective — never throws. A brief the
// trader is looking at right now should never fail to render just because
// history logging had a hiccup.
export async function insertGexBrief(input: {
  assetClass: 'equity' | 'crypto'
  symbol: string
  status: GexStatus
  keyChange: string
  narrative: string
  narrativeSource: 'ai' | 'deterministic'
  facts: GexBriefFacts
}): Promise<void> {
  const admin = createAdminClient()
  if (!admin) return

  try {
    await admin.from('gex_briefs').insert({
      asset_class: input.assetClass,
      symbol: input.symbol,
      status: input.status,
      key_change: input.keyChange,
      narrative: input.narrative,
      narrative_source: input.narrativeSource,
      facts: input.facts,
    })
  } catch (error) {
    console.error('[insertGexBrief] Error:', error)
  }
}

export async function listGexBriefs(assetClass: 'equity' | 'crypto', symbol: string, limit = 10): Promise<GexBriefRecord[]> {
  const admin = createAdminClient()
  if (!admin) return []

  const { data, error } = await admin
    .from('gex_briefs')
    .select(SELECT_COLUMNS)
    .eq('asset_class', assetClass)
    .eq('symbol', symbol)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error || !data) return []
  return (data as GexBriefRow[]).map(mapRow)
}
