'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { clsx } from 'clsx'
import type { Trade, TradeChecklist } from '@/components/tools/TradeJournal'
import { TradeLogPanel } from '@/components/journal/TradeLogPanel'
import { TradeAuditPanel } from '@/components/journal/TradeAuditPanel'
import { computeTradeAudit } from '@/lib/journal/audit-engine'
import type { TradeJournalEntry, TradeChecklist as PersistedChecklist } from '@/lib/oracle/persistence'

type ApiTrade = {
  id: string
  symbol: string
  side: 'BUY' | 'SELL'
  result: string
  profit: number
  createdAt: string
  entryPrice: number | null
  stopLoss: number | null
  takeProfit: number | null
  exitPrice: number | null
  lotSize: number | null
  commission: number
  swap: number
  notes?: string | null
  checklist?: TradeChecklist | null
}

const DOW = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB']

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
const netPnl = (t: Trade) => t.profit - (t.commission ?? 0) - (t.swap ?? 0)
const isClosed = (t: Trade) => t.result !== 'OPEN'

function money(v: number) {
  return `${v >= 0 ? '+' : '-'}$${Math.abs(Math.round(v)).toLocaleString('en-US')}`
}

function rMultiple(t: Trade): number | null {
  if (!isClosed(t) || t.entryPrice == null || t.stopLoss == null) return null
  const risk = Math.abs(t.entryPrice - t.stopLoss)
  if (!risk) return null
  if (t.exitPrice != null) {
    const move = t.type === 'SELL' ? t.entryPrice - t.exitPrice : t.exitPrice - t.entryPrice
    return move / risk
  }
  if (t.profit < 0) return -1
  if (t.takeProfit != null) return Math.abs(t.takeProfit - t.entryPrice) / risk
  return null
}

export default function ToolsPage() {
  const [trades, setTrades] = useState<Trade[]>([])
  const [loading, setLoading] = useState(true)
  const today = useMemo(() => new Date(), [])
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [selectedDay, setSelectedDay] = useState<Date>(today)

  useEffect(() => {
    let mounted = true
    const loadTrades = async () => {
      try {
        const response = await fetch('/api/journal/trades')
        const payload = await response.json()
        if (!mounted) return
        const items = (payload?.data ?? []) as ApiTrade[]
        setTrades(
          items.map((item) => ({
            id: item.id,
            symbol: item.symbol,
            type: item.side,
            result: item.result,
            profit: item.profit,
            date: new Date(item.createdAt).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
            createdAt: item.createdAt,
            entryPrice: item.entryPrice,
            stopLoss: item.stopLoss,
            takeProfit: item.takeProfit,
            exitPrice: item.exitPrice,
            lotSize: item.lotSize,
            commission: item.commission,
            swap: item.swap,
            checklist: item.checklist ?? null,
          })),
        )
      } catch {
        if (!mounted) return
        setTrades([])
      } finally {
        if (mounted) setLoading(false)
      }
    }
    loadTrades()
    return () => {
      mounted = false
    }
  }, [])

  const addTrade = (trade: Trade) => {
    setTrades((prev) => [trade, ...prev])
    const d = trade.createdAt ? new Date(trade.createdAt) : new Date()
    setSelectedDay(d)
    setMonth(new Date(d.getFullYear(), d.getMonth(), 1))
  }

  // Group by local day
  const byDay = useMemo(() => {
    const map = new Map<string, Trade[]>()
    for (const t of trades) {
      if (!t.createdAt) continue
      const k = dayKey(new Date(t.createdAt))
      const list = map.get(k) ?? []
      list.push(t)
      map.set(k, list)
    }
    return map
  }, [trades])

  const monthTrades = useMemo(
    () =>
      trades.filter((t) => {
        if (!t.createdAt) return false
        const d = new Date(t.createdAt)
        return d.getFullYear() === month.getFullYear() && d.getMonth() === month.getMonth()
      }),
    [trades, month],
  )

  const monthStats = useMemo(() => {
    const closed = monthTrades.filter(isClosed)
    const wins = closed.filter((t) => netPnl(t) > 0)
    const pnl = closed.reduce((a, t) => a + netPnl(t), 0)
    const dayTotals = new Map<string, number>()
    for (const t of closed) {
      const k = dayKey(new Date(t.createdAt!))
      dayTotals.set(k, (dayTotals.get(k) ?? 0) + netPnl(t))
    }
    const green = [...dayTotals.values()].filter((v) => v > 0).length
    return {
      pnl,
      winRate: closed.length ? Math.round((wins.length / closed.length) * 100) : null,
      count: monthTrades.length,
      green,
      tradedDays: dayTotals.size,
    }
  }, [monthTrades])

  const cells = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1)
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
    const lead = first.getDay()
    const total = Math.ceil((lead + daysInMonth) / 7) * 7
    return Array.from({ length: total }, (_, i) => {
      const n = i - lead + 1
      if (n < 1 || n > daysInMonth) return null
      return new Date(month.getFullYear(), month.getMonth(), n)
    })
  }, [month])

  const maxAbsDay = useMemo(() => {
    let m = 1
    for (const [, list] of byDay) {
      const v = Math.abs(list.filter(isClosed).reduce((a, t) => a + netPnl(t), 0))
      if (v > m) m = v
    }
    return m
  }, [byDay])

  const dayTrades = useMemo(
    () => [...(byDay.get(dayKey(selectedDay)) ?? [])].sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? '')),
    [byDay, selectedDay],
  )
  const dayClosedPnl = dayTrades.filter(isClosed).reduce((a, t) => a + netPnl(t), 0)
  const dayHasClosed = dayTrades.some(isClosed)

  const auditStats = useMemo(() => {
    const entries: TradeJournalEntry[] = trades.map((t) => ({
      id: String(t.id),
      symbol: t.symbol,
      side: (t.type === 'SELL' ? 'SELL' : 'BUY') as 'BUY' | 'SELL',
      result: t.result,
      profit: t.profit,
      entryPrice: t.entryPrice ?? null,
      stopLoss: t.stopLoss ?? null,
      takeProfit: t.takeProfit ?? null,
      exitPrice: t.exitPrice ?? null,
      lotSize: t.lotSize ?? null,
      commission: t.commission ?? 0,
      swap: t.swap ?? 0,
      closedAt: null,
      source: 'manual',
      notes: null,
      createdAt: t.createdAt ?? new Date().toISOString(),
    }))
    const checklists: Record<string, PersistedChecklist> = {}
    for (const t of trades) {
      if (!t.checklist) continue
      checklists[String(t.id)] = {
        tradeId: String(t.id),
        preStructure: t.checklist.preStructure,
        preZone: t.checklist.preZone,
        preTiming: t.checklist.preTiming,
        preRisk: t.checklist.preRisk,
        postPlanFollowed: t.checklist.postPlanFollowed,
        postExecutionQuality: t.checklist.postExecutionQuality,
        postEmotionStable: t.checklist.postEmotionStable,
        postLessonLogged: t.checklist.postLessonLogged,
        setupScore: t.checklist.setupScore,
        setupBias: t.checklist.setupBias,
        confluenceCount: t.checklist.confluenceCount,
        setupRules: t.checklist.setupRules,
        emotionTag: t.checklist.emotionTag ?? null,
        mistakeTag: t.checklist.mistakeTag ?? null,
        notes: t.checklist.notes,
        updatedAt: t.checklist.updatedAt,
      }
    }
    return computeTradeAudit(entries, checklists)
  }, [trades])

  const monthLabel = month.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
  const shiftMonth = (delta: number) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1))

  return (
    <div className="space-y-8 animate-fade-in pb-20 max-w-[1400px]">
      <div className="rounded-xl border border-bg-border bg-bg-deep overflow-hidden grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_400px]">
        {/* Calendar + day detail */}
        <section className="px-5 md:px-8 py-7 flex flex-col gap-[22px] xl:border-r border-bg-border min-w-0">
          <div className="flex flex-wrap justify-between items-end gap-5">
            <div className="space-y-1.5">
              <p className="text-[11px] font-mono uppercase tracking-[0.16em] text-pulse">Diario de trading</p>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => shiftMonth(-1)} aria-label="Mes anterior" className="w-7 h-7 rounded-md border border-bg-border text-ink-secondary hover:text-ink-primary">←</button>
                <h1 className="text-[26px] font-sans font-medium text-ink-primary capitalize">{monthLabel}</h1>
                <button type="button" onClick={() => shiftMonth(1)} aria-label="Mes siguiente" className="w-7 h-7 rounded-md border border-bg-border text-ink-secondary hover:text-ink-primary">→</button>
              </div>
            </div>
            <div className="flex gap-7 font-mono">
              <div className="flex flex-col items-end gap-0.5">
                <span className={clsx('text-[22px] tabular-nums', monthStats.pnl >= 0 ? 'text-atlas' : 'text-bear')}>{money(monthStats.pnl)}</span>
                <span className="font-sans text-[11px] text-ink-secondary">P/L del mes</span>
              </div>
              <div className="flex flex-col items-end gap-0.5">
                <span className="text-[22px] text-ink-primary tabular-nums">{monthStats.winRate != null ? `${monthStats.winRate}%` : '—'}</span>
                <span className="font-sans text-[11px] text-ink-secondary">Win rate · {monthStats.count} trades</span>
              </div>
              <div className="flex flex-col items-end gap-0.5">
                <span className="text-[22px] text-ink-primary tabular-nums">{monthStats.green} / {monthStats.tradedDays}</span>
                <span className="font-sans text-[11px] text-ink-secondary">Días verdes</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {DOW.map((d) => (
              <span key={d} className="pb-1 text-center text-[10px] font-mono tracking-[0.1em] text-ink-muted">{d}</span>
            ))}
            {cells.map((date, i) => {
              if (!date) return <span key={`e-${i}`} />
              const list = byDay.get(dayKey(date)) ?? []
              const closed = list.filter(isClosed)
              const pnl = closed.reduce((a, t) => a + netPnl(t), 0)
              const hasPnl = closed.length > 0
              const alpha = hasPnl ? (0.12 + Math.min(Math.abs(pnl) / maxAbsDay, 1) * 0.4).toFixed(2) : null
              const isSel = dayKey(date) === dayKey(selectedDay)
              const isToday = dayKey(date) === dayKey(today)
              const muted = !list.length && (date.getDay() === 0 || date.getDay() === 6 || date > today)
              return (
                <button
                  key={date.toISOString()}
                  type="button"
                  onClick={() => setSelectedDay(date)}
                  aria-pressed={isSel}
                  aria-label={`${date.getDate()}: ${list.length} operaciones${hasPnl ? `, ${money(pnl)}` : ''}`}
                  className={clsx(
                    'h-[78px] rounded-lg border px-2.5 py-2 flex flex-col justify-between text-left transition-colors',
                    isSel ? 'border-pulse' : isToday ? 'border-ink-muted' : 'border-bg-elevated hover:border-bg-border',
                    muted && 'opacity-45',
                  )}
                  style={{
                    background: hasPnl ? (pnl >= 0 ? `rgba(16,185,129,${alpha})` : `rgba(239,68,68,${alpha})`) : '#0F0D0A',
                  }}
                >
                  <span className="flex justify-between font-mono text-[11px]">
                    <span className={isToday ? 'text-pulse' : 'text-ink-primary/80'}>{date.getDate()}</span>
                    {list.length > 0 && <span className="text-ink-secondary">{list.length}t</span>}
                  </span>
                  {hasPnl && <span className="font-mono text-sm font-semibold text-ink-primary tabular-nums">{money(pnl)}</span>}
                  {!hasPnl && list.length > 0 && <span className="font-mono text-[11px] text-pulse">abierta</span>}
                </button>
              )
            })}
          </div>

          <div className="flex flex-col gap-2.5 pt-1.5">
            <div className="flex justify-between items-baseline">
              <p className="text-[11px] font-mono uppercase tracking-[0.14em] text-ink-secondary">
                {selectedDay.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })} · {dayTrades.length} operaciones
              </p>
              {dayHasClosed && (
                <span className={clsx('text-[13px] font-mono tabular-nums', dayClosedPnl >= 0 ? 'text-atlas' : 'text-bear')}>{money(dayClosedPnl)}</span>
              )}
            </div>
            {loading && <p className="text-[13px] font-sans text-ink-muted py-3">Cargando journal…</p>}
            {!loading && dayTrades.length === 0 && <p className="text-[13px] font-sans text-ink-muted py-3">Sin operaciones este día.</p>}
            {dayTrades.map((t) => {
              const r = rMultiple(t)
              const closed = isClosed(t)
              const pnl = netPnl(t)
              return (
                <div
                  key={String(t.id)}
                  className="grid grid-cols-[56px_90px_52px_minmax(0,1fr)_64px_80px] gap-3.5 items-center px-4 py-3 rounded-lg border border-bg-border bg-bg-base text-xs"
                >
                  <span className="font-mono text-ink-secondary tabular-nums">
                    {t.createdAt ? new Date(t.createdAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '—'}
                  </span>
                  <Link href={`/dashboard/stock/${t.symbol}`} className="font-mono font-semibold text-ink-primary hover:text-pulse truncate">{t.symbol}</Link>
                  <span className={clsx('font-mono', t.type === 'BUY' ? 'text-atlas' : 'text-bear')}>{t.type}</span>
                  <span className="font-sans text-ink-secondary truncate">
                    {t.checklist?.notes || (t.checklist?.setupScore != null ? `Setup ${t.checklist.setupScore}` : '—')}
                  </span>
                  <span className={clsx('font-mono text-right tabular-nums', r == null ? 'text-ink-muted' : r >= 0 ? 'text-atlas' : 'text-bear')}>
                    {r == null ? '—' : `${r >= 0 ? '+' : ''}${r.toFixed(1)}R`}
                  </span>
                  <span className={clsx('font-mono text-right font-semibold tabular-nums', !closed ? 'text-pulse' : pnl >= 0 ? 'text-atlas' : 'text-bear')}>
                    {closed ? money(pnl) : 'Abierta'}
                  </span>
                </div>
              )
            })}
          </div>
        </section>

        <TradeLogPanel onCreated={addTrade} />
      </div>

      <TradeAuditPanel stats={auditStats} />

      <div className="flex items-center justify-between rounded-xl border border-bg-border px-5 py-4">
        <div>
          <p className="text-sm font-sans text-ink-primary">¿Buscas la calculadora?</p>
          <p className="text-xs font-sans text-ink-secondary">Position sizing y lot calculator tienen su propia página.</p>
        </div>
        <Link href="/dashboard/calculators" className="text-[13px] font-sans text-pulse hover:text-pulse/80">Abrir →</Link>
      </div>
    </div>
  )
}
