import type { OracleAlert } from '@/lib/oracle/types'
import { createAdminClient } from '@/lib/supabase/admin'

export type TradeJournalEntry = {
  id: string
  symbol: string
  side: 'BUY' | 'SELL'
  result: string
  profit: number
  entryPrice: number | null
  stopLoss: number | null
  takeProfit: number | null
  notes: string | null
  createdAt: string
}

export type TradeChecklist = {
  tradeId: string
  preStructure: boolean
  preZone: boolean
  preTiming: boolean
  preRisk: boolean
  postPlanFollowed: boolean
  postExecutionQuality: boolean
  postEmotionStable: boolean
  postLessonLogged: boolean
  setupScore: number | null
  setupBias: string | null
  confluenceCount: number | null
  setupRules: unknown
  notes: string | null
  updatedAt: string
}

type OracleAlertRow = {
  id: string
  type: string
  severity: string
  title: string
  message: string
  symbol: string | null
  timestamp: string
  is_read: boolean
  zone_top: number | null
  zone_bottom: number | null
  zone_label: string | null
}

type TradeJournalRow = {
  id: string
  symbol: string
  side: 'BUY' | 'SELL'
  result: string
  profit: number
  entry_price: number | null
  stop_loss: number | null
  take_profit: number | null
  notes: string | null
  created_at: string
}

type TradeChecklistRow = {
  trade_id: string
  pre_structure: boolean
  pre_zone: boolean
  pre_timing: boolean
  pre_risk: boolean
  post_plan_followed: boolean
  post_execution_quality: boolean
  post_emotion_stable: boolean
  post_lesson_logged: boolean
  setup_score: number | null
  setup_bias: string | null
  confluence_count: number | null
  setup_rules: unknown
  notes: string | null
  updated_at: string
}

function mapAlertToRow(alert: OracleAlert): OracleAlertRow {
  return {
    id: alert.id,
    type: alert.type,
    severity: alert.severity,
    title: alert.title,
    message: alert.message,
    symbol: alert.symbol ?? null,
    timestamp: alert.timestamp,
    is_read: alert.read,
    zone_top: alert.priceZone?.top ?? null,
    zone_bottom: alert.priceZone?.bottom ?? null,
    zone_label: alert.priceZone?.label ?? null,
  }
}

function mapRowToAlert(row: OracleAlertRow): OracleAlert {
  return {
    id: row.id,
    type: row.type as OracleAlert['type'],
    severity: row.severity as OracleAlert['severity'],
    title: row.title,
    message: row.message,
    symbol: row.symbol ?? undefined,
    timestamp: row.timestamp,
    read: row.is_read,
    priceZone:
      row.zone_top !== null && row.zone_bottom !== null && row.zone_label
        ? { top: row.zone_top, bottom: row.zone_bottom, label: row.zone_label }
        : undefined,
  }
}

function mapTradeRow(row: TradeJournalRow): TradeJournalEntry {
  return {
    id: row.id,
    symbol: row.symbol,
    side: row.side,
    result: row.result,
    profit: row.profit,
    entryPrice: row.entry_price,
    stopLoss: row.stop_loss,
    takeProfit: row.take_profit,
    notes: row.notes,
    createdAt: row.created_at,
  }
}

function mapChecklistRow(row: TradeChecklistRow): TradeChecklist {
  return {
    tradeId: row.trade_id,
    preStructure: row.pre_structure,
    preZone: row.pre_zone,
    preTiming: row.pre_timing,
    preRisk: row.pre_risk,
    postPlanFollowed: row.post_plan_followed,
    postExecutionQuality: row.post_execution_quality,
    postEmotionStable: row.post_emotion_stable,
    postLessonLogged: row.post_lesson_logged,
    setupScore: row.setup_score,
    setupBias: row.setup_bias,
    confluenceCount: row.confluence_count,
    setupRules: row.setup_rules,
    notes: row.notes,
    updatedAt: row.updated_at,
  }
}

export async function upsertOracleAlerts(alerts: OracleAlert[]): Promise<void> {
  if (alerts.length === 0) return
  const admin = createAdminClient()
  if (!admin) return

  const rows = alerts.map(mapAlertToRow)
  await admin.from('oracle_alerts').upsert(rows, { onConflict: 'id' })
}

export async function listOracleAlerts(limit = 100): Promise<OracleAlert[]> {
  const admin = createAdminClient()
  if (!admin) return []

  const { data, error } = await admin
    .from('oracle_alerts')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(limit)

  if (error || !data) return []
  return (data as OracleAlertRow[]).map(mapRowToAlert)
}

export async function markOracleAlertRead(id: string, read: boolean): Promise<boolean> {
  const admin = createAdminClient()
  if (!admin) return false

  const { error } = await admin.from('oracle_alerts').update({ is_read: read }).eq('id', id)
  return !error
}

export async function listTradeJournalEntries(limit = 200): Promise<TradeJournalEntry[]> {
  const admin = createAdminClient()
  if (!admin) return []

  const { data, error } = await admin
    .from('trade_journal_entries')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error || !data) return []
  return (data as TradeJournalRow[]).map(mapTradeRow)
}

export async function insertTradeJournalEntry(input: {
  symbol: string
  side: 'BUY' | 'SELL'
  result?: string
  profit?: number
  entryPrice?: number | null
  stopLoss?: number | null
  takeProfit?: number | null
  notes?: string | null
}): Promise<TradeJournalEntry | null> {
  const admin = createAdminClient()
  if (!admin) return null

  const payload = {
    symbol: input.symbol,
    side: input.side,
    result: input.result ?? 'OPEN',
    profit: input.profit ?? 0,
    entry_price: input.entryPrice ?? null,
    stop_loss: input.stopLoss ?? null,
    take_profit: input.takeProfit ?? null,
    notes: input.notes ?? null,
  }

  const { data, error } = await admin
    .from('trade_journal_entries')
    .insert(payload)
    .select('*')
    .single()

  if (error || !data) return null
  return mapTradeRow(data as TradeJournalRow)
}

export async function getTradeChecklist(tradeId: string): Promise<TradeChecklist | null> {
  const admin = createAdminClient()
  if (!admin) return null

  const { data, error } = await admin
    .from('trade_journal_checklists')
    .select('*')
    .eq('trade_id', tradeId)
    .maybeSingle()

  if (error || !data) return null
  return mapChecklistRow(data as TradeChecklistRow)
}

export async function listTradeChecklistsByTradeIds(tradeIds: string[]): Promise<Record<string, TradeChecklist>> {
  const admin = createAdminClient()
  if (!admin || tradeIds.length === 0) return {}

  const { data, error } = await admin
    .from('trade_journal_checklists')
    .select('*')
    .in('trade_id', tradeIds)

  if (error || !data) return {}

  const mapped = (data as TradeChecklistRow[]).map(mapChecklistRow)
  return Object.fromEntries(mapped.map((item) => [item.tradeId, item]))
}

export async function upsertTradeChecklist(input: {
  tradeId: string
  preStructure?: boolean
  preZone?: boolean
  preTiming?: boolean
  preRisk?: boolean
  postPlanFollowed?: boolean
  postExecutionQuality?: boolean
  postEmotionStable?: boolean
  postLessonLogged?: boolean
  setupScore?: number | null
  setupBias?: string | null
  confluenceCount?: number | null
  setupRules?: unknown
  notes?: string | null
}): Promise<TradeChecklist | null> {
  const admin = createAdminClient()
  if (!admin) return null

  const payload = {
    trade_id: input.tradeId,
    pre_structure: input.preStructure ?? false,
    pre_zone: input.preZone ?? false,
    pre_timing: input.preTiming ?? false,
    pre_risk: input.preRisk ?? false,
    post_plan_followed: input.postPlanFollowed ?? false,
    post_execution_quality: input.postExecutionQuality ?? false,
    post_emotion_stable: input.postEmotionStable ?? false,
    post_lesson_logged: input.postLessonLogged ?? false,
    setup_score: input.setupScore ?? null,
    setup_bias: input.setupBias ?? null,
    confluence_count: input.confluenceCount ?? null,
    setup_rules: input.setupRules ?? null,
    notes: input.notes ?? null,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await admin
    .from('trade_journal_checklists')
    .upsert(payload, { onConflict: 'trade_id' })
    .select('*')
    .single()

  if (error || !data) return null
  return mapChecklistRow(data as TradeChecklistRow)
}
