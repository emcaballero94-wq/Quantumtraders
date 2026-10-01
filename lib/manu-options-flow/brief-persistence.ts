import { createAdminClient } from '@/lib/supabase/admin'
import type { OptionsFlowBriefFacts, OptionsFlowLean } from './types'

export interface OptionsFlowBriefRecord {
  id: string
  currency: 'BTC' | 'ETH'
  lean: OptionsFlowLean
  keyChange: string
  narrative: string
  narrativeSource: 'ai' | 'deterministic'
  facts: OptionsFlowBriefFacts
  createdAt: string
}

interface OptionsFlowBriefRow {
  id: string
  currency: 'BTC' | 'ETH'
  lean: OptionsFlowLean
  key_change: string
  narrative: string
  narrative_source: 'ai' | 'deterministic'
  facts: OptionsFlowBriefFacts
  created_at: string
}

const SELECT_COLUMNS = 'id, currency, lean, key_change, narrative, narrative_source, facts, created_at'

function mapRow(row: OptionsFlowBriefRow): OptionsFlowBriefRecord {
  return {
    id: row.id,
    currency: row.currency,
    lean: row.lean,
    keyChange: row.key_change,
    narrative: row.narrative,
    narrativeSource: row.narrative_source,
    facts: row.facts,
    createdAt: row.created_at,
  }
}

// Fire-and-forget from the caller's perspective — never throws, same
// contract as insertGexBrief.
export async function insertOptionsFlowBrief(input: {
  currency: 'BTC' | 'ETH'
  lean: OptionsFlowLean
  keyChange: string
  narrative: string
  narrativeSource: 'ai' | 'deterministic'
  facts: OptionsFlowBriefFacts
}): Promise<void> {
  const admin = createAdminClient()
  if (!admin) return

  try {
    await admin.from('options_flow_briefs').insert({
      currency: input.currency,
      lean: input.lean,
      key_change: input.keyChange,
      narrative: input.narrative,
      narrative_source: input.narrativeSource,
      facts: input.facts,
    })
  } catch (error) {
    console.error('[insertOptionsFlowBrief] Error:', error)
  }
}

export async function listOptionsFlowBriefs(currency: 'BTC' | 'ETH', limit = 10): Promise<OptionsFlowBriefRecord[]> {
  const admin = createAdminClient()
  if (!admin) return []

  const { data, error } = await admin
    .from('options_flow_briefs')
    .select(SELECT_COLUMNS)
    .eq('currency', currency)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error || !data) return []
  return (data as OptionsFlowBriefRow[]).map(mapRow)
}

// For the outcome-tracking cron: oldest-first, so a backlog (e.g. right after
// this feature ships) catches up gradually instead of always re-fetching the
// same newest-eligible page. Relies on the caller (and the DB's unique
// constraint on brief_outcomes) to skip ones already scored — this just
// returns candidates old enough to be eligible.
export async function listOptionsFlowBriefsOlderThan(
  currency: 'BTC' | 'ETH',
  cutoffIso: string,
  limit = 50,
): Promise<OptionsFlowBriefRecord[]> {
  const admin = createAdminClient()
  if (!admin) return []

  const { data, error } = await admin
    .from('options_flow_briefs')
    .select(SELECT_COLUMNS)
    .eq('currency', currency)
    .lte('created_at', cutoffIso)
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error || !data) return []
  return (data as OptionsFlowBriefRow[]).map(mapRow)
}
