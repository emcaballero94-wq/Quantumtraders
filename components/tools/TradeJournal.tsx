'use client'

import { clsx } from 'clsx'
import { Fragment, useEffect, useMemo, useState } from 'react'

export interface TradeChecklist {
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

type ChecklistBooleanKey =
  | 'preStructure'
  | 'preZone'
  | 'preTiming'
  | 'preRisk'
  | 'postPlanFollowed'
  | 'postExecutionQuality'
  | 'postEmotionStable'
  | 'postLessonLogged'

type JournalView = 'dashboard' | 'nuevo' | 'historial'

type ApiTrade = {
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
  checklist?: TradeChecklist | null
}

type TradeForm = {
  symbol: string
  side: 'BUY' | 'SELL'
  result: string
  entryPrice: string
  stopLoss: string
  takeProfit: string
  profit: string
  notes: string
}

export interface Trade {
  id: string | number
  symbol: string
  type: string
  result: string
  profit: number
  date: string
  entryPrice?: number | null
  stopLoss?: number | null
  takeProfit?: number | null
  notes?: string | null
  checklist?: TradeChecklist | null
}

interface TradeJournalProps {
  trades: Trade[]
  loading?: boolean
  onTradeCreated?: (trade: Trade) => void
}

function toNumber(value: string): number | null {
  const normalized = value.trim().replace(',', '.')
  if (!normalized) return null
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function toCsvValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  return `"${String(value).replaceAll('"', '""')}"`
}

function checklistCompletion(checklist: TradeChecklist | null | undefined): number {
  if (!checklist) return 0
  const items = [
    checklist.preStructure,
    checklist.preZone,
    checklist.preTiming,
    checklist.preRisk,
    checklist.postPlanFollowed,
    checklist.postExecutionQuality,
    checklist.postEmotionStable,
    checklist.postLessonLogged,
  ]
  return Math.round((items.filter(Boolean).length / items.length) * 100)
}

function setupBiasLabel(setupBias: string | null | undefined): string {
  if (setupBias === 'long') return 'alcista'
  if (setupBias === 'short') return 'bajista'
  return 'neutral'
}

function formatProfitFactor(value: number | null): string {
  if (value === null) return '--'
  if (!Number.isFinite(value)) return '∞'
  return value.toFixed(2)
}

function mapTrade(item: ApiTrade): Trade {
  return {
    id: item.id,
    symbol: item.symbol,
    type: item.side,
    result: item.result,
    profit: item.profit,
    entryPrice: item.entryPrice,
    stopLoss: item.stopLoss,
    takeProfit: item.takeProfit,
    notes: item.notes,
    checklist: item.checklist ?? null,
    date: new Date(item.createdAt).toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }),
  }
}

export function TradeJournal({ trades, loading = false, onTradeCreated }: TradeJournalProps) {
  const [view, setView] = useState<JournalView>('dashboard')
  const [rows, setRows] = useState<Trade[]>(trades)
  const [expandedId, setExpandedId] = useState<string | number | null>(null)
  const [savingId, setSavingId] = useState<string | number | null>(null)
  const [postingTrade, setPostingTrade] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)
  const [filterSide, setFilterSide] = useState('')
  const [filterResult, setFilterResult] = useState('')
  const [drafts, setDrafts] = useState<Record<string, TradeChecklist>>({})
  const [form, setForm] = useState<TradeForm>({
    symbol: '',
    side: 'BUY',
    result: 'OPEN',
    entryPrice: '',
    stopLoss: '',
    takeProfit: '',
    profit: '',
    notes: '',
  })

  useEffect(() => {
    setRows(trades)
  }, [trades])

  useEffect(() => {
    const seed: Record<string, TradeChecklist> = {}
    for (const trade of rows) {
      if (!trade.checklist) continue
      seed[String(trade.id)] = trade.checklist
    }
    setDrafts(seed)
  }, [rows])

  const closedTrades = useMemo(() => rows.filter((trade) => trade.result !== 'OPEN'), [rows])
  const totalProfit = useMemo(() => rows.reduce((acc, trade) => acc + trade.profit, 0), [rows])
  const wins = useMemo(() => closedTrades.filter((trade) => trade.profit > 0).length, [closedTrades])
  const losses = useMemo(() => closedTrades.filter((trade) => trade.profit < 0).length, [closedTrades])
  const winRate = closedTrades.length > 0 ? Math.round((wins / closedTrades.length) * 100) : 0
  const avgWin = wins > 0 ? closedTrades.filter((trade) => trade.profit > 0).reduce((sum, trade) => sum + trade.profit, 0) / wins : 0
  const avgLoss = losses > 0 ? closedTrades.filter((trade) => trade.profit < 0).reduce((sum, trade) => sum + trade.profit, 0) / losses : 0
  const rrAvg = avgLoss < 0 ? (Math.abs(avgWin / avgLoss)).toFixed(2) : '--'

  const equitySeries = useMemo(() => {
    let cumulative = 0
    return closedTrades.slice().reverse().map((trade, index) => {
      cumulative += trade.profit
      return { index: index + 1, value: Number(cumulative.toFixed(2)) }
    })
  }, [closedTrades])

  const equityChart = useMemo(() => {
    if (equitySeries.length === 0) return null
    const values = equitySeries.map((point) => point.value)
    const min = Math.min(...values, 0)
    const max = Math.max(...values, 0)
    const range = max - min || 1
    const points = equitySeries
      .map((point, index) => {
        const x = equitySeries.length === 1 ? 0 : (index / (equitySeries.length - 1)) * 100
        const y = 100 - ((point.value - min) / range) * 100
        return `${x},${y}`
      })
      .join(' ')
    const zeroY = 100 - ((0 - min) / range) * 100
    return {
      min,
      max,
      points,
      zeroY: Math.min(100, Math.max(0, zeroY)),
      lastValue: equitySeries[equitySeries.length - 1]?.value ?? 0,
    }
  }, [equitySeries])

  const assetProfitFactors = useMemo(() => {
    const bySymbol = new Map<string, { symbol: string; trades: number; net: number; grossWin: number; grossLossAbs: number }>()
    for (const trade of closedTrades) {
      const symbol = trade.symbol.toUpperCase()
      const current = bySymbol.get(symbol) ?? { symbol, trades: 0, net: 0, grossWin: 0, grossLossAbs: 0 }
      current.trades += 1
      current.net += trade.profit
      if (trade.profit > 0) current.grossWin += trade.profit
      if (trade.profit < 0) current.grossLossAbs += Math.abs(trade.profit)
      bySymbol.set(symbol, current)
    }

    return [...bySymbol.values()]
      .map((item) => ({
        ...item,
        profitFactor: item.grossLossAbs > 0 ? item.grossWin / item.grossLossAbs : item.grossWin > 0 ? Infinity : null,
      }))
      .sort((left, right) => right.net - left.net)
  }, [closedTrades])

  const filteredRows = useMemo(
    () =>
      rows.filter((trade) => (filterSide ? trade.type === filterSide : true))
        .filter((trade) => (filterResult ? trade.result === filterResult : true)),
    [rows, filterResult, filterSide],
  )

  const preview = useMemo(() => {
    const entry = toNumber(form.entryPrice)
    const sl = toNumber(form.stopLoss)
    const tp = toNumber(form.takeProfit)
    if (!entry || !sl || !tp) return null
    const risk = Math.abs(entry - sl)
    const reward = Math.abs(tp - entry)
    if (risk <= 0) return null
    return { rr: (reward / risk).toFixed(2), risk }
  }, [form.entryPrice, form.stopLoss, form.takeProfit])

  const exportCsv = () => {
    if (filteredRows.length === 0) {
      setFeedback({ type: 'error', text: 'No hay operaciones para exportar.' })
      return
    }

    const headers = ['fecha', 'symbol', 'side', 'result', 'entry', 'sl', 'tp', 'profit', 'notes']
    const rowsCsv = filteredRows.map((trade) =>
      [
        toCsvValue(trade.date),
        toCsvValue(trade.symbol),
        toCsvValue(trade.type),
        toCsvValue(trade.result),
        toCsvValue(trade.entryPrice ?? ''),
        toCsvValue(trade.stopLoss ?? ''),
        toCsvValue(trade.takeProfit ?? ''),
        toCsvValue(trade.profit),
        toCsvValue(trade.notes ?? ''),
      ].join(','),
    )

    const csv = [headers.join(','), ...rowsCsv].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `journal_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    URL.revokeObjectURL(url)
    setFeedback({ type: 'ok', text: 'CSV exportado.' })
  }

  const createTrade = async () => {
    const symbol = form.symbol.trim().toUpperCase()
    if (!symbol) {
      setFeedback({ type: 'error', text: 'Completa al menos el símbolo.' })
      return
    }

    setPostingTrade(true)
    try {
      const response = await fetch('/api/journal/trades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol,
          side: form.side,
          result: form.result,
          profit: toNumber(form.profit) ?? 0,
          entryPrice: toNumber(form.entryPrice),
          stopLoss: toNumber(form.stopLoss),
          takeProfit: toNumber(form.takeProfit),
          notes: form.notes.trim() || null,
        }),
      })
      const payload = await response.json()
      if (!response.ok || !payload?.success || !payload?.data) throw new Error('create-failed')
      const mapped = mapTrade(payload.data as ApiTrade)
      setRows((prev) => [mapped, ...prev.filter((item) => String(item.id) !== String(mapped.id))])
      onTradeCreated?.(mapped)
      setView('historial')
      setForm({ symbol: '', side: 'BUY', result: 'OPEN', entryPrice: '', stopLoss: '', takeProfit: '', profit: '', notes: '' })
      setFeedback({ type: 'ok', text: 'Trade guardado correctamente.' })
    } catch {
      setFeedback({ type: 'error', text: 'No se pudo guardar el trade.' })
    } finally {
      setPostingTrade(false)
    }
  }

  const updateDraft = (tradeId: string | number, patch: Partial<TradeChecklist>) => {
    const key = String(tradeId)
    const existing = drafts[key] ?? rows.find((trade) => String(trade.id) === key)?.checklist
    if (!existing) return
    setDrafts((prev) => ({ ...prev, [key]: { ...existing, ...patch } }))
  }

  const persistChecklist = async (tradeId: string | number) => {
    const key = String(tradeId)
    const checklist = drafts[key]
    if (!checklist) return

    setSavingId(tradeId)
    try {
      await fetch('/api/journal/checklist', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tradeId: key,
          preStructure: checklist.preStructure,
          preZone: checklist.preZone,
          preTiming: checklist.preTiming,
          preRisk: checklist.preRisk,
          postPlanFollowed: checklist.postPlanFollowed,
          postExecutionQuality: checklist.postExecutionQuality,
          postEmotionStable: checklist.postEmotionStable,
          postLessonLogged: checklist.postLessonLogged,
          notes: checklist.notes,
        }),
      })
      setFeedback({ type: 'ok', text: 'Checklist actualizado.' })
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="rounded-xl border border-bg-border bg-bg-deep overflow-hidden flex flex-col glass h-full">
      <div className="px-5 py-4 border-b border-bg-border bg-bg-card/50 flex items-center justify-between">
        <h3 className="text-xs font-mono font-bold text-ink-primary uppercase tracking-widest">Bitácora de Trading</h3>
        <button onClick={exportCsv} className="text-[10px] font-mono text-oracle hover:underline uppercase">Exportar CSV</button>
      </div>

      <div className="px-4 py-3 border-b border-bg-border bg-bg-card/30 flex gap-2">
        {(['dashboard', 'nuevo', 'historial'] as const).map((item) => (
          <button
            key={item}
            onClick={() => setView(item)}
            className={clsx(
              'px-3 py-1.5 rounded text-[10px] font-mono uppercase border',
              view === item ? 'border-oracle/30 bg-oracle/10 text-oracle' : 'border-bg-border bg-bg-elevated/20 text-ink-muted hover:bg-bg-elevated/40',
            )}
          >
            {item}
          </button>
        ))}
      </div>

      {feedback && (
        <div
          className={clsx(
            'px-4 py-2 text-[10px] font-mono border-b border-bg-border',
            feedback.type === 'ok' ? 'text-atlas bg-atlas/5' : 'text-bear bg-bear/5',
          )}
        >
          {feedback.text}
        </div>
      )}

      {view === 'dashboard' && (
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 xl:grid-cols-6 gap-2">
            <StatCard label="P/L Total" value={`${totalProfit >= 0 ? '+' : ''}${totalProfit.toFixed(2)}$`} tone={totalProfit >= 0 ? 'good' : 'bad'} />
            <StatCard label="Win Rate" value={`${winRate}%`} />
            <StatCard label="Cerradas" value={`${closedTrades.length}`} />
            <StatCard label="Wins/Loss" value={`${wins}/${losses}`} />
            <StatCard label="Avg Win" value={`${avgWin.toFixed(2)}$`} tone="good" />
            <StatCard label="R:R Avg" value={rrAvg === '--' ? '--' : `1:${rrAvg}`} />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
            <div className="xl:col-span-2 rounded-lg border border-bg-border bg-bg-card p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-mono text-ink-muted uppercase">Curva de Equity</p>
                <p className={clsx('text-[10px] font-mono', (equityChart?.lastValue ?? 0) >= 0 ? 'text-atlas' : 'text-bear')}>
                  {equityChart ? `${equityChart.lastValue >= 0 ? '+' : ''}${equityChart.lastValue.toFixed(2)}$` : '--'}
                </p>
              </div>

              {equityChart ? (
                <>
                  <div className="h-40 rounded border border-bg-border bg-bg-deep/60 p-2">
                    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
                      <line x1="0" y1={equityChart.zeroY} x2="100" y2={equityChart.zeroY} stroke="rgba(148,163,184,0.25)" strokeWidth="0.8" />
                      <polyline
                        fill="none"
                        stroke={equityChart.lastValue >= 0 ? 'rgba(16,185,129,0.95)' : 'rgba(239,68,68,0.95)'}
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        points={equityChart.points}
                      />
                    </svg>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[10px] font-mono text-ink-dim">
                    <span>Min: {equityChart.min.toFixed(2)}$</span>
                    <span>Max: {equityChart.max.toFixed(2)}$</span>
                    <span>Trades: {equitySeries.length}</span>
                  </div>
                </>
              ) : (
                <p className="text-xs font-mono text-ink-dim py-8 text-center">No hay trades cerrados para generar curva.</p>
              )}
            </div>

            <div className="rounded-lg border border-bg-border bg-bg-card p-3">
              <p className="text-[10px] font-mono text-ink-muted uppercase mb-2">Profit Factor por activo</p>
              <div className="space-y-2">
                {assetProfitFactors.slice(0, 8).map((asset) => (
                  <div key={asset.symbol} className="rounded border border-bg-border bg-bg-elevated/20 px-2 py-1.5">
                    <div className="flex items-center justify-between text-[10px] font-mono">
                      <span className="text-ink-secondary">{asset.symbol}</span>
                      <span className={clsx('font-semibold', asset.net >= 0 ? 'text-atlas' : 'text-bear')}>
                        {asset.net >= 0 ? '+' : ''}{asset.net.toFixed(2)}$
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[9px] font-mono text-ink-dim">
                      <span>PF {formatProfitFactor(asset.profitFactor)}</span>
                      <span>{asset.trades} trades</span>
                    </div>
                  </div>
                ))}
                {assetProfitFactors.length === 0 && (
                  <p className="text-xs font-mono text-ink-dim py-8 text-center">Sin datos por activo todavía.</p>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-bg-border bg-bg-card p-3">
            <p className="text-[10px] font-mono text-ink-muted uppercase mb-2">Últimas operaciones</p>
            <div className="space-y-2">
              {rows.slice(0, 6).map((trade) => (
                <div key={String(trade.id)} className="flex items-center justify-between text-xs font-mono">
                  <span className="text-ink-secondary">{trade.symbol} · {trade.type}</span>
                  <span className={trade.profit >= 0 ? 'text-atlas' : 'text-bear'}>
                    {trade.profit >= 0 ? '+' : ''}{trade.profit}$
                  </span>
                </div>
              ))}
              {rows.length === 0 && <p className="text-xs font-mono text-ink-dim">Sin operaciones aún.</p>}
            </div>
          </div>
        </div>
      )}

      {view === 'nuevo' && (
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <input value={form.symbol} onChange={(event) => setForm((prev) => ({ ...prev, symbol: event.target.value }))} placeholder="Activo (BTCUSDT)" className="bg-bg-deep border border-bg-border rounded px-3 py-2 text-xs font-mono text-ink-primary" />
            <select value={form.side} onChange={(event) => setForm((prev) => ({ ...prev, side: event.target.value as 'BUY' | 'SELL' }))} className="bg-bg-deep border border-bg-border rounded px-3 py-2 text-xs font-mono text-ink-primary">
              <option value="BUY">BUY</option>
              <option value="SELL">SELL</option>
            </select>
            <select value={form.result} onChange={(event) => setForm((prev) => ({ ...prev, result: event.target.value }))} className="bg-bg-deep border border-bg-border rounded px-3 py-2 text-xs font-mono text-ink-primary">
              <option value="OPEN">OPEN</option>
              <option value="WIN">WIN</option>
              <option value="LOSS">LOSS</option>
              <option value="BE">BE</option>
            </select>
            <input value={form.profit} onChange={(event) => setForm((prev) => ({ ...prev, profit: event.target.value }))} placeholder="P/L manual" className="bg-bg-deep border border-bg-border rounded px-3 py-2 text-xs font-mono text-ink-primary" />
            <input value={form.entryPrice} onChange={(event) => setForm((prev) => ({ ...prev, entryPrice: event.target.value }))} placeholder="Entrada" className="bg-bg-deep border border-bg-border rounded px-3 py-2 text-xs font-mono text-ink-primary" />
            <input value={form.stopLoss} onChange={(event) => setForm((prev) => ({ ...prev, stopLoss: event.target.value }))} placeholder="Stop Loss" className="bg-bg-deep border border-bg-border rounded px-3 py-2 text-xs font-mono text-ink-primary" />
            <input value={form.takeProfit} onChange={(event) => setForm((prev) => ({ ...prev, takeProfit: event.target.value }))} placeholder="Take Profit" className="bg-bg-deep border border-bg-border rounded px-3 py-2 text-xs font-mono text-ink-primary md:col-span-2" />
          </div>
          <textarea value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} rows={3} placeholder="Notas del setup y ejecución..." className="w-full bg-bg-deep border border-bg-border rounded px-3 py-2 text-xs font-mono text-ink-primary" />
          {preview && (
            <p className="text-[10px] font-mono text-ink-muted">
              R:R estimado <span className="text-oracle">1:{preview.rr}</span> · Riesgo por unidad: {preview.risk.toFixed(2)}
            </p>
          )}
          <div className="flex justify-end">
            <button onClick={createTrade} disabled={postingTrade} className="px-4 py-2 border border-oracle/30 bg-oracle/10 rounded-lg text-[10px] font-mono text-oracle uppercase tracking-wider hover:bg-oracle/20 disabled:opacity-60">
              {postingTrade ? 'Guardando...' : 'Guardar operación'}
            </button>
          </div>
        </div>
      )}

      {view === 'historial' && (
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 py-3 border-b border-bg-border bg-bg-card/20 flex gap-2">
            <select value={filterSide} onChange={(event) => setFilterSide(event.target.value)} className="bg-bg-deep border border-bg-border rounded px-2 py-1.5 text-[10px] font-mono text-ink-primary">
              <option value="">Todos lados</option>
              <option value="BUY">BUY</option>
              <option value="SELL">SELL</option>
            </select>
            <select value={filterResult} onChange={(event) => setFilterResult(event.target.value)} className="bg-bg-deep border border-bg-border rounded px-2 py-1.5 text-[10px] font-mono text-ink-primary">
              <option value="">Todos resultados</option>
              <option value="OPEN">OPEN</option>
              <option value="WIN">WIN</option>
              <option value="LOSS">LOSS</option>
              <option value="BE">BE</option>
            </select>
            <span className="ml-auto text-[10px] font-mono text-ink-dim">{filteredRows.length} operaciones</span>
          </div>

          <table className="w-full text-left font-mono text-xs">
            <thead>
              <tr className="border-b border-bg-border text-[9px] text-ink-dim uppercase">
                <th className="px-4 py-2">Fecha</th>
                <th className="px-4 py-2">Par</th>
                <th className="px-4 py-2">Dir</th>
                <th className="px-4 py-2">Res</th>
                <th className="px-4 py-2">P/L</th>
                <th className="px-4 py-2 text-right">Checklist</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bg-border/50">
              {loading && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-ink-dim">Cargando journal...</td>
                </tr>
              )}
              {!loading && filteredRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-ink-dim">Sin operaciones.</td>
                </tr>
              )}
              {!loading && filteredRows.map((trade) => {
                const checklist = drafts[String(trade.id)] ?? trade.checklist ?? null
                const expanded = expandedId === trade.id
                return (
                  <Fragment key={String(trade.id)}>
                    <tr className="hover:bg-bg-elevated/40">
                      <td className="px-4 py-3 text-ink-dim">{trade.date}</td>
                      <td className="px-4 py-3 font-semibold text-ink-primary">{trade.symbol}</td>
                      <td className="px-4 py-3">
                        <span className={trade.type === 'BUY' ? 'text-atlas' : 'text-bear'}>{trade.type}</span>
                      </td>
                      <td className="px-4 py-3 text-ink-secondary">{trade.result}</td>
                      <td className={clsx('px-4 py-3 font-semibold', trade.profit >= 0 ? 'text-atlas' : 'text-bear')}>
                        {trade.profit >= 0 ? '+' : ''}{trade.profit}$
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => setExpandedId(expanded ? null : trade.id)} className="text-[10px] text-oracle uppercase">
                          {expanded ? 'Ocultar' : `Ver (${checklistCompletion(checklist)}%)`}
                        </button>
                      </td>
                    </tr>
                    {expanded && (
                      <tr>
                        <td colSpan={6} className="px-4 pb-4">
                          <div className="rounded-lg border border-bg-border bg-bg-card p-3 space-y-3">
                            <p className="text-[10px] font-mono text-ink-muted">
                              Setup: {checklist?.setupScore ?? '--'} · Sesgo {setupBiasLabel(checklist?.setupBias)}
                            </p>
                            {checklist ? (
                              <>
                                <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                                  <ChecklistGroup
                                    title="Pre-Trade"
                                    items={[
                                      { label: 'Estructura validada', key: 'preStructure' },
                                      { label: 'Zona confirmada', key: 'preZone' },
                                      { label: 'Timing de sesión', key: 'preTiming' },
                                      { label: 'Riesgo definido', key: 'preRisk' },
                                    ]}
                                    checklist={checklist}
                                    onToggle={(key, value) => updateDraft(trade.id, { [key]: value })}
                                  />
                                  <ChecklistGroup
                                    title="Post-Trade"
                                    items={[
                                      { label: 'Seguí el plan', key: 'postPlanFollowed' },
                                      { label: 'Ejecución limpia', key: 'postExecutionQuality' },
                                      { label: 'Gestión emocional', key: 'postEmotionStable' },
                                      { label: 'Lección documentada', key: 'postLessonLogged' },
                                    ]}
                                    checklist={checklist}
                                    onToggle={(key, value) => updateDraft(trade.id, { [key]: value })}
                                  />
                                </div>
                                <textarea
                                  value={checklist.notes ?? ''}
                                  onChange={(event) => updateDraft(trade.id, { notes: event.target.value })}
                                  rows={2}
                                  className="w-full bg-bg-deep border border-bg-border rounded px-3 py-2 text-xs font-mono text-ink-primary"
                                />
                                {Array.isArray(checklist.setupRules) && checklist.setupRules.length > 0 && (
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    {checklist.setupRules.map((rule: any) => (
                                      <div key={rule.id} className="text-[10px] font-mono px-3 py-2 border border-bg-border rounded bg-bg-elevated/30">
                                        <div className="flex items-center justify-between gap-2">
                                          <span className="text-ink-secondary">{rule.label}</span>
                                          <span className={rule.passed ? 'text-atlas' : 'text-bear'}>{rule.score}</span>
                                        </div>
                                        <p className="text-ink-dim mt-1">{rule.evidence}</p>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                <div className="flex justify-end">
                                  <button onClick={() => persistChecklist(trade.id)} disabled={savingId === trade.id} className="px-4 py-2 border border-oracle/30 bg-oracle/10 rounded-lg text-[10px] font-mono text-oracle uppercase tracking-wider hover:bg-oracle/20 disabled:opacity-60">
                                    {savingId === trade.id ? 'Guardando...' : 'Guardar checklist'}
                                  </button>
                                </div>
                              </>
                            ) : (
                              <p className="text-xs font-mono text-ink-dim">Este trade aún no tiene checklist.</p>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function StatCard({
  label,
  value,
  tone = 'neutral',
}: {
  label: string
  value: string
  tone?: 'neutral' | 'good' | 'bad'
}) {
  return (
    <div className={clsx(
      'rounded border px-3 py-2',
      tone === 'good'
        ? 'border-atlas/30 bg-atlas/10'
        : tone === 'bad'
          ? 'border-bear/30 bg-bear/10'
          : 'border-bg-border bg-bg-elevated/20',
    )}>
      <p className="text-[9px] font-mono uppercase text-ink-dim">{label}</p>
      <p className="text-xs font-mono font-semibold text-ink-secondary mt-1">{value}</p>
    </div>
  )
}

function ChecklistGroup({
  title,
  items,
  checklist,
  onToggle,
}: {
  title: string
  items: Array<{ label: string; key: ChecklistBooleanKey }>
  checklist: TradeChecklist
  onToggle: (key: ChecklistBooleanKey, value: boolean) => void
}) {
  return (
    <div className="space-y-2 rounded-lg border border-bg-border bg-bg-elevated/20 p-3">
      <p className="text-[10px] font-mono text-ink-muted uppercase">{title}</p>
      <div className="space-y-2">
        {items.map((item) => (
          <label key={item.key} className="flex items-center gap-2 text-xs font-mono text-ink-secondary">
            <input
              type="checkbox"
              checked={Boolean(checklist[item.key])}
              onChange={(event) => onToggle(item.key, event.target.checked)}
              className="w-3.5 h-3.5 rounded border-bg-border bg-bg-card"
            />
            {item.label}
          </label>
        ))}
      </div>
    </div>
  )
}
