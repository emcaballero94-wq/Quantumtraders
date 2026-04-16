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
