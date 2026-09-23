'use client'

import { useEffect, useMemo, useState } from 'react'
import { clsx } from 'clsx'
import { riskRegimeFromVix, computeAggregateBias } from '@/lib/oracle/risk-regime'
import type { RadarAsset, SectorStrength, EconomicEvent, EventImpact } from '@/lib/oracle/types'
import type { RelativeStrengthResult } from '@/lib/market-relative-strength'
import { EconomicCalendar, type DayPnl } from '@/components/pulse/EconomicCalendar'

interface OracleStateResponse {
  success: boolean
  data?: { radar: RadarAsset[]; sectorStrength: SectorStrength[]; calendar: EconomicEvent[] }
}
interface QuoteItem {
  symbol: string
  price: number | null
  changePct: number | null
  high: number | null
  low: number | null
}
interface JournalTrade {
  createdAt: string
  profit: number
  commission: number
  swap: number
  result: string
}
interface QuoteResponse {
  quotes: QuoteItem[]
}
interface HistoryPoint {
  close: number
}
interface RelativeStrengthResponse {
  success: boolean
  data?: RelativeStrengthResult
}
interface PulseBriefResponse {
  success: boolean
  data?: { brief: string }
  error?: string
}

const INSTRUMENTS = ['SPX500', 'NAS100', 'US30', 'USOIL', 'XAUUSD', 'BTCUSD']
const LABELS: Record<string, string> = { SPX500: 'S&P 500', NAS100: 'Nasdaq 100', US30: 'Dow Jones', USOIL: 'WTI Crude', XAUUSD: 'Oro', BTCUSD: 'Bitcoin' }
const RS_BASE = 'XAUUSD'
const RS_SYMBOLS = ['SPX500', 'NAS100', 'US30', 'BTCUSD', 'USOIL']
const SERIES_COLOR: Record<string, string> = {
  SPX500: '#7C3AED',
  NAS100: '#F5B83D',
  US30: '#10B981',
  BTCUSD: '#F97316',
  USOIL: '#EF4444',
  XAUUSD: '#FFD166',
}
const UP = '#10B981'
const DOWN = '#EF4444'
const IMPACT_DOT: Record<EventImpact, string> = { high: 'bg-bear', medium: 'bg-pulse', low: 'bg-oracle' }

const RS_W = 740
const RS_H = 250
const DD_W = 200
const DD_H = 64
const DD_FLOOR = -40

function linePath(values: number[], w: number, h: number, lo: number, hi: number, pad = 2) {
  if (values.length < 2) return ''
  return values
    .map((v, i) => `${i ? 'L' : 'M'}${((i / (values.length - 1)) * w).toFixed(1)},${(pad + (1 - (v - lo) / (hi - lo || 1)) * (h - pad * 2)).toFixed(1)}`)
    .join('')
}

function fmtPct(v: number | null | undefined, digits = 1) {
  if (v == null || !Number.isFinite(v)) return '—'
  return `${v > 0 ? '+' : ''}${v.toFixed(digits)}%`
}

function fmtPrice(symbol: string, v: number | null | undefined) {
  if (v == null) return '—'
  const d = symbol === 'BTCUSD' ? 0 : 2
  return v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
}

function heat(v: number | null | undefined, max: number): React.CSSProperties {
  if (v == null || !Number.isFinite(v)) return { background: '#161310', color: '#7A6F5C' }
  const a = 0.12 + Math.min(Math.abs(v) / max, 1) * 0.6
  return { background: v >= 0 ? `rgba(16,185,129,${a.toFixed(2)})` : `rgba(239,68,68,${a.toFixed(2)})`, color: '#F3EFE7' }
}

function intensityWord(avg: number) {
  if (avg >= 65) return 'fuerte'
  if (avg >= 45) return 'moderado'
  return 'débil'
}

function Eyebrow({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex justify-between items-baseline gap-4">
      <p className="text-[11px] font-mono uppercase tracking-[0.16em] text-ink-secondary">{children}</p>
      {right && <p className="text-[11px] font-mono text-ink-muted">{right}</p>}
    </div>
  )
}

function Sparkline({ values, up }: { values: number[]; up: boolean }) {
  if (values.length < 2) return <div className="h-9" />
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const d = linePath(values, 180, 36, lo, hi)
  return (
    <svg viewBox="0 0 180 36" preserveAspectRatio="none" className="block w-full h-9" aria-hidden>
      <path d={`${d}L180,36L0,36Z`} fill={up ? 'rgba(16,185,129,.1)' : 'rgba(239,68,68,.1)'} />
      <path d={d} fill="none" stroke={up ? UP : DOWN} strokeWidth={1.4} vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

export default function PulsePage() {
  const [radar, setRadar] = useState<RadarAsset[]>([])
  const [sectorStrength, setSectorStrength] = useState<SectorStrength[]>([])
  const [calendar, setCalendar] = useState<EconomicEvent[]>([])
  const [trades, setTrades] = useState<JournalTrade[]>([])
  const [quotes, setQuotes] = useState<Record<string, QuoteItem>>({})
  const [histories, setHistories] = useState<Record<string, number[]>>({})
  const [rs, setRs] = useState<RelativeStrengthResult | null>(null)
  const [brief, setBrief] = useState<string | null>(null)
  const [briefError, setBriefError] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [agendaView, setAgendaView] = useState<'week' | 'month'>('week')

  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        const [statePayload, quotePayload, tradesPayload, ...historyPayloads] = await Promise.all([
          fetch('/api/oracle/state').then((r) => r.json() as Promise<OracleStateResponse>),
          fetch(`/api/market/quote?symbols=VIX,${INSTRUMENTS.join(',')}`).then((r) => r.json() as Promise<QuoteResponse>),
          fetch('/api/journal/trades').then((r) => r.json()).catch(() => ({ data: [] })),
          ...INSTRUMENTS.map((s) =>
            fetch(`/api/market/history?symbol=${s}&interval=1h&outputsize=48`).then((r) => r.json() as Promise<HistoryPoint[]>).catch(() => []),
          ),
        ])
        if (!mounted) return
        setRadar(statePayload?.data?.radar ?? [])
        setSectorStrength(statePayload?.data?.sectorStrength ?? [])
        setCalendar(statePayload?.data?.calendar ?? [])
        setTrades((tradesPayload?.data ?? []) as JournalTrade[])
        const qMap: Record<string, QuoteItem> = {}
        for (const q of quotePayload?.quotes ?? []) qMap[q.symbol] = q
        setQuotes(qMap)
        const hMap: Record<string, number[]> = {}
        INSTRUMENTS.forEach((s, i) => {
          const rows = Array.isArray(historyPayloads[i]) ? historyPayloads[i] : []
          hMap[s] = rows.map((c) => c.close).filter((v): v is number => Number.isFinite(v))
        })
        setHistories(hMap)
        setUpdatedAt(new Date())
      } catch {
        // keep last good state
      }
    }
    load()
    const timer = setInterval(load, 60_000)
    return () => {
      mounted = false
      clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    let mounted = true
    fetch(`/api/market/relative-strength?symbols=${RS_SYMBOLS.join(',')}&base=${RS_BASE}`)
      .then((r) => r.json() as Promise<RelativeStrengthResponse>)
      .then((p) => mounted && p.success && p.data && setRs(p.data))
      .catch(() => {})
    return () => {
      mounted = false
    }
  }, [])

  const dailyPnl: DayPnl[] = useMemo(() => {
    const byDay = new Map<string, { pnl: number; trades: number }>()
    for (const t of trades) {
      if (t.result === 'OPEN') continue
      const day = t.createdAt.slice(0, 10)
      const entry = byDay.get(day) ?? { pnl: 0, trades: 0 }
      entry.pnl += t.profit - t.commission - t.swap
      entry.trades += 1
      byDay.set(day, entry)
    }
    return [...byDay.entries()].map(([date, v]) => ({ date, pnl: v.pnl, trades: v.trades }))
  }, [trades])

  const vix = quotes.VIX?.price ?? null
  const regime = riskRegimeFromVix(vix)
  const biasAgg = useMemo(() => computeAggregateBias(radar), [radar])
  const biasBySymbol = useMemo(() => Object.fromEntries(radar.map((a) => [a.symbol, a.bias])), [radar])

  useEffect(() => {
    if (!biasAgg) return
    let mounted = true
    fetch('/api/market/pulse-brief', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        biasLabel: biasAgg.label,
        biasIntensity: biasAgg.avgScore,
        bullishCount: biasAgg.bullish,
        bearishCount: biasAgg.bearish,
        neutralCount: biasAgg.neutral,
        vixLabel: regime.label,
        vix,
        strongestSector: sectorStrength[0]?.sector ?? null,
        weakestSector: sectorStrength[sectorStrength.length - 1]?.sector ?? null,
        relativeStrengthTop: [],
        drawdownWorst: [],
      }),
    })
      .then((r) => r.json() as Promise<PulseBriefResponse>)
      .then((p) => {
        if (!mounted) return
        if (p.success && p.data) {
          setBrief(p.data.brief)
          setBriefError(null)
        } else {
          setBrief(null)
          setBriefError(p.error ?? null)
        }
      })
      .catch(() => mounted && setBrief(null))
    return () => {
      mounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [biasAgg, vix])

  // ── Relative strength chart geometry ──
  const rsRows = rs?.relativeStrength ?? []
  const rsChart = useMemo(() => {
    const series = rsRows
      .map((row) => ({ symbol: row.symbol, values: (row.series ?? []).map((p) => p.value).filter(Number.isFinite) }))
      .filter((s) => s.values.length > 1)
    if (series.length === 0) return null
    const all = series.flatMap((s) => s.values)
    const lo = Math.min(...all, 100) - 2
    const hi = Math.max(...all, 100) + 2
    const y = (v: number) => 2 + (1 - (v - lo) / (hi - lo)) * (RS_H - 4)
    const ends = series.map((s) => ({ symbol: s.symbol, y: y(s.values[s.values.length - 1]) })).sort((a, b) => a.y - b.y)
    for (let k = 1; k < ends.length; k++) if (ends[k].y - ends[k - 1].y < 16) ends[k].y = ends[k - 1].y + 16
    return {
      baseY: y(100),
      lines: series.map((s) => ({
        symbol: s.symbol,
        d: linePath(s.values, RS_W, RS_H, lo, hi),
        labelY: ends.find((e) => e.symbol === s.symbol)!.y,
      })),
    }
  }, [rsRows])

  const rsBySymbol = useMemo(() => Object.fromEntries(rsRows.map((r) => [r.symbol, r])), [rsRows])
  const ddRows = rs?.drawdown ?? []
  const ddBySymbol = useMemo(() => Object.fromEntries(ddRows.map((r) => [r.symbol, r])), [ddRows])
  const rsSorted = useMemo(() => [...rsRows].sort((a, b) => (b.change90d ?? -999) - (a.change90d ?? -999)), [rsRows])
  const ddSorted = useMemo(() => [...ddRows].sort((a, b) => (a.maxDrawdownPct ?? 0) - (b.maxDrawdownPct ?? 0)), [ddRows])

  const highlight = selected && rsBySymbol[selected] ? selected : null

  // ── Agenda (next 7 days) ──
  const agenda = useMemo(() => {
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    return Array.from({ length: 7 }, (_, k) => {
      const day = new Date(start)
      day.setDate(start.getDate() + k)
      const key = day.toDateString()
      const items = calendar
        .filter((e) => new Date(e.datetime).toDateString() === key)
        .sort((a, b) => a.datetime.localeCompare(b.datetime))
      return { day, items, isToday: k === 0 }
    }).filter((g) => g.isToday || g.items.length > 0)
  }, [calendar])

  const biasPct = Math.max(0, Math.min(100, biasAgg?.avgScore ?? 50))
  const vixPos = vix != null ? Math.max(0, Math.min(100, ((vix - 10) / 30) * 100)) : null
  const briefMissingKey = briefError?.includes('ANTHROPIC_API_KEY')

  return (
    <div className="space-y-10 animate-fade-in pb-20 max-w-[1280px]">
      {/* Headline + bias */}
      <section className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_380px] gap-8 xl:gap-12 items-end">
        <div className="space-y-3.5">
          <p className="text-[11px] font-mono uppercase tracking-[0.16em] text-pulse">
            Pulse · Estado del mercado
            {updatedAt && ` · ${updatedAt.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })} UTC`}
          </p>
          <h1 className="text-3xl md:text-[42px] font-sans font-medium leading-[1.15] tracking-tight text-ink-primary text-pretty">
            <span className={regime.color}>{regime.label}</span>
            {biasAgg && (biasAgg.label === 'Mixto' ? ' con sesgo mixto. ' : ` con sesgo ${biasAgg.label.toLowerCase()} ${intensityWord(biasAgg.avgScore)}. `)}
            <span className="text-ink-secondary">
              {biasAgg && `${biasAgg.bullish} de ${biasAgg.bullish + biasAgg.bearish + biasAgg.neutral} activos al alza`}
              {vix != null && `, VIX en ${vix.toFixed(1)}`}.
            </span>
          </h1>
          {brief ? (
            <p className="text-[15px] font-sans leading-relaxed text-ink-primary/85 max-w-3xl text-pretty">{brief}</p>
          ) : (
            <p className="flex items-center gap-2 text-[13px] font-sans text-ink-secondary">
              <span className="text-[10px] font-mono tracking-[0.12em] text-oracle border border-oracle/35 px-1.5 py-0.5 rounded-[3px]">IA</span>
              {briefMissingKey ? 'Resumen en vivo desactivado — falta ANTHROPIC_API_KEY.' : 'Resumen en vivo no disponible todavía.'}
            </p>
          )}
        </div>
        <div className="rounded-xl border border-bg-border bg-bg-card px-6 py-5 space-y-3.5">
          <div className="flex items-baseline justify-between">
            <span className="text-[13px] font-sans text-ink-secondary">Bias agregado</span>
            <span className="text-[28px] font-mono text-ink-primary tabular-nums">{biasAgg ? biasAgg.avgScore.toFixed(1) : '—'}</span>
          </div>
          <div className="relative h-2 rounded bg-gradient-to-r from-bear via-ink-muted to-atlas">
            <div className="absolute -top-[5px] h-[18px] w-[3px] rounded-sm bg-ink-primary -translate-x-1/2 transition-all" style={{ left: `${biasPct}%` }} />
          </div>
          <div className="flex justify-between text-[11px] font-mono text-ink-secondary">
            <span>Débil</span><span>Moderado</span><span>Fuerte</span>
          </div>
          {biasAgg && (
            <div className="flex gap-[18px] pt-2.5 border-t border-bg-border text-xs font-mono">
              <span className="text-atlas">{biasAgg.bullish} alcistas</span>
              <span className="text-bear">{biasAgg.bearish} bajistas</span>
              <span className="text-ink-secondary">{biasAgg.neutral} neutrales</span>
            </div>
          )}
        </div>
      </section>

      {/* Instruments strip */}
      <section className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 rounded-xl border border-bg-border overflow-hidden gap-px bg-bg-border">
        {INSTRUMENTS.map((symbol) => {
          const q = quotes[symbol]
          const hist = histories[symbol] ?? []
          const up = hist.length > 1 ? hist[hist.length - 1] >= hist[0] : (q?.changePct ?? 0) >= 0
          const range = q?.high != null && q?.low != null && q?.price != null && q.high > q.low ? ((q.price - q.low) / (q.high - q.low)) * 100 : null
          return (
            <div key={symbol} className="bg-bg-card px-[18px] py-4 space-y-2">
              <div className="flex justify-between items-baseline font-mono text-xs">
                <span className="font-semibold text-ink-primary">{symbol}</span>
                <span className={clsx('tabular-nums', (q?.changePct ?? 0) >= 0 ? 'text-atlas' : 'text-bear')}>{fmtPct(q?.changePct, 2)}</span>
              </div>
              <p className="text-[19px] font-mono text-ink-primary tabular-nums">{fmtPrice(symbol, q?.price)}</p>
              <Sparkline values={hist} up={up} />
              <div className="space-y-1">
                <div className="relative h-[3px] rounded-full bg-bg-border">
                  {range != null && <div className="absolute -top-[3px] w-0.5 h-[9px] bg-ink-primary -translate-x-1/2" style={{ left: `${range}%` }} />}
                </div>
                <p className="text-[9px] font-mono text-ink-muted">RANGO DEL DÍA</p>
              </div>
            </div>
          )
        })}
      </section>

      {/* Sectors + VIX */}
      <section className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_380px] gap-10">
        <div className="space-y-3">
          <Eyebrow right="ETFs sectoriales · -100 a +100">Ranking sectorial</Eyebrow>
          {sectorStrength.map((s, i) => {
            const v = Math.max(-100, Math.min(100, s.score))
            const up = v >= 0
            return (
              <div key={s.sector} className="grid grid-cols-[28px_170px_minmax(0,1fr)_44px] gap-3 items-center text-[13px]">
                <span className="text-[11px] font-mono text-ink-muted">#{i + 1}</span>
                <span className="font-sans text-ink-primary/80 truncate capitalize">{s.sector.toLowerCase()}</span>
                <div className="relative h-2.5">
                  <div className="absolute left-1/2 -top-[3px] -bottom-[3px] w-px bg-bg-border" />
                  <div
                    className={clsx('absolute top-0 h-2.5 rounded-sm', up ? 'bg-atlas' : 'bg-bear')}
                    style={{ left: up ? '50%' : `${50 - Math.abs(v) / 2}%`, width: `${Math.abs(v) / 2}%` }}
                  />
                </div>
                <span className={clsx('text-xs font-mono text-right tabular-nums', up ? 'text-atlas' : 'text-bear')}>{up ? '+' : ''}{v}</span>
              </div>
            )
          })}
        </div>
        <div className="space-y-4">
          <Eyebrow>Medidor de riesgo · VIX</Eyebrow>
          <div className="flex items-baseline gap-3">
            <span className="text-5xl font-mono leading-none text-ink-primary tabular-nums">{vix != null ? vix.toFixed(2) : '—'}</span>
            <span className={clsx('text-sm font-sans', regime.color)}>{regime.label}</span>
          </div>
          <div className="space-y-1.5">
            <div className="relative grid grid-cols-[5fr_5fr_10fr_10fr] gap-0.5 h-2.5">
              <div className="bg-atlas rounded-l-sm" />
              <div className="bg-[#6fae7a]" />
              <div className="bg-pulse" />
              <div className="bg-bear rounded-r-sm" />
              {vixPos != null && <div className="absolute -top-[5px] w-[3px] h-5 rounded-sm bg-ink-primary -translate-x-1/2" style={{ left: `${vixPos}%` }} />}
            </div>
            <div className="grid grid-cols-[5fr_5fr_10fr_10fr] text-[10px] font-mono text-ink-secondary">
              <span>10</span><span>15</span><span>20</span><span>30 →</span>
            </div>
          </div>
          <p className="text-[13px] font-sans leading-relaxed text-ink-secondary text-pretty">
            Por debajo de 15 el entorno favorece activos de riesgo. Por encima de 20 el régimen pasa a cautela.
          </p>
        </div>
      </section>

      {/* Asset matrix (click to highlight in RS chart) */}
      <section className="space-y-3.5">
        <Eyebrow right="Clic en una fila para destacarla en el gráfico">Matriz de activos</Eyebrow>
        <div className="overflow-x-auto">
          <div className="min-w-[860px]">
            <div className="grid grid-cols-[150px_110px_repeat(5,minmax(0,1fr))_90px] gap-1 pb-2 text-[10px] font-mono tracking-[0.1em] text-ink-muted">
              <span className="pl-2">ACTIVO</span>
              <span className="text-right pr-2.5">PRECIO</span>
              <span className="text-center">HOY</span>
              <span className="text-center">RS 20D</span>
              <span className="text-center">RS 60D</span>
              <span className="text-center">RS 90D</span>
              <span className="text-center">DRAWDOWN</span>
              <span className="text-right pr-2">BIAS</span>
            </div>
            {INSTRUMENTS.map((symbol) => {
              const q = quotes[symbol]
              const r = rsBySymbol[symbol]
              const dd = ddBySymbol[symbol]
              const isBase = symbol === RS_BASE
              const bias = biasBySymbol[symbol]
              const isSel = highlight === symbol
              const dimmed = highlight != null && !isSel
              return (
                <button
                  key={symbol}
                  type="button"
                  onClick={() => setSelected((cur) => (cur === symbol ? null : symbol))}
                  aria-pressed={isSel}
                  className={clsx(
                    'w-full text-left grid grid-cols-[150px_110px_repeat(5,minmax(0,1fr))_90px] gap-1 items-center py-[3px] rounded-md transition-opacity',
                    isSel && 'ring-1 ring-inset ring-pulse',
                    dimmed ? 'opacity-70 hover:opacity-100' : 'opacity-100',
                  )}
                >
                  <span className="flex items-center gap-2.5 pl-2 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: SERIES_COLOR[symbol] }} />
                    <span className="min-w-0">
                      <span className="block text-[13px] font-mono font-semibold text-ink-primary">{symbol}</span>
                      <span className="block text-[11px] font-sans text-ink-secondary truncate">{LABELS[symbol]}</span>
                    </span>
                  </span>
                  <span className="text-[13px] font-mono text-right pr-2.5 tabular-nums text-ink-primary">{fmtPrice(symbol, q?.price)}</span>
                  {[
                    [q?.changePct, 0.5, fmtPct(q?.changePct, 2)],
                    [r?.change20d, 20, isBase ? 'base' : fmtPct(r?.change20d)],
                    [r?.change60d, 30, isBase ? 'base' : fmtPct(r?.change60d)],
                    [r?.change90d, 15, isBase ? 'base' : fmtPct(r?.change90d)],
                    [dd?.maxDrawdownPct, 40, dd?.maxDrawdownPct != null ? `${dd.maxDrawdownPct.toFixed(1)}%` : '—'],
                  ].map(([v, max, txt], k) => (
                    <span
                      key={k}
                      className="h-[38px] rounded flex items-center justify-center text-xs font-mono tabular-nums"
                      style={heat(isBase && k > 0 && k < 4 ? null : (v as number | null | undefined), max as number)}
                    >
                      {txt as string}
                    </span>
                  ))}
                  <span
                    className={clsx(
                      'text-xs font-sans text-right pr-2',
                      bias === 'long' ? 'text-atlas' : bias === 'short' ? 'text-bear' : 'text-ink-secondary',
                    )}
                  >
                    {bias === 'long' ? '▲ Alcista' : bias === 'short' ? '▼ Bajista' : bias ? '● Neutral' : '—'}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </section>

      {/* Relative strength */}
      {rsChart && (
        <section className="space-y-3.5">
          <Eyebrow right="20D · 60D · 90D">Fuerza relativa vs oro · base 100 · 6 meses</Eyebrow>
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_330px] gap-7 items-start">
            <div className="relative w-full aspect-[820/250]">
              <svg viewBox={`0 0 ${RS_W + 80} ${RS_H}`} className="absolute inset-0 w-full h-full" aria-label="Fuerza relativa">
                <line x1={0} y1={rsChart.baseY} x2={RS_W} y2={rsChart.baseY} stroke="#3A342A" strokeDasharray="3 4" />
                {rsChart.lines.map((l) => {
                  const on = !highlight || highlight === l.symbol
                  return (
                    <path
                      key={l.symbol}
                      d={l.d}
                      fill="none"
                      stroke={SERIES_COLOR[l.symbol] ?? '#B8AD98'}
                      strokeOpacity={on ? 1 : 0.15}
                      strokeWidth={highlight === l.symbol ? 2.6 : 1.6}
                      className="transition-[stroke-opacity] duration-200"
                    />
                  )
                })}
                {rsChart.lines.map((l) => (
                  <text
                    key={`lbl-${l.symbol}`}
                    x={RS_W + 8}
                    y={l.labelY + 4}
                    fontSize={11}
                    fontWeight={600}
                    fontFamily="IBM Plex Mono, monospace"
                    fill={SERIES_COLOR[l.symbol] ?? '#B8AD98'}
                    opacity={!highlight || highlight === l.symbol ? 1 : 0.35}
                    className="cursor-pointer"
                    onClick={() => setSelected((cur) => (cur === l.symbol ? null : l.symbol))}
                  >
                    {l.symbol}
                  </text>
                ))}
              </svg>
            </div>
            <div>
              <div className="grid grid-cols-[78px_repeat(3,minmax(0,1fr))_40px] gap-2 pb-2 text-[10px] font-mono text-ink-muted border-b border-bg-border">
                <span />
                <span className="text-right">20D</span>
                <span className="text-right">60D</span>
                <span className="text-right">90D</span>
                <span className="text-right">SCORE</span>
              </div>
              {rsSorted.map((r) => {
                const pos = [r.change20d, r.change60d, r.change90d].filter((v) => v != null && v > 0).length
                return (
                  <button
                    key={r.symbol}
                    type="button"
                    onClick={() => setSelected((cur) => (cur === r.symbol ? null : r.symbol))}
                    className={clsx(
                      'w-full grid grid-cols-[78px_repeat(3,minmax(0,1fr))_40px] gap-2 items-center py-2.5 border-b border-bg-elevated text-xs font-mono tabular-nums transition-opacity',
                      highlight && highlight !== r.symbol ? 'opacity-40' : 'opacity-100',
                    )}
                  >
                    <span className="text-left font-semibold" style={{ color: SERIES_COLOR[r.symbol] }}>{r.symbol}</span>
                    {[r.change20d, r.change60d, r.change90d].map((v, k) => (
                      <span key={k} className={clsx('text-right', v == null ? 'text-ink-muted' : v >= 0 ? 'text-atlas' : 'text-bear')}>{fmtPct(v)}</span>
                    ))}
                    <span className="text-right text-ink-primary">{pos}/3</span>
                  </button>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* Drawdown small multiples */}
      {ddSorted.length > 0 && (
        <section className="space-y-3.5">
          <Eyebrow right={`misma escala 0 a ${DD_FLOOR}%`}>Drawdown · caída desde máximo · 6 meses</Eyebrow>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
            {ddSorted.map((row) => {
              const values = (row.series ?? []).map((p) => Math.max(DD_FLOOR, p.value)).filter(Number.isFinite)
              const d = linePath(values, DD_W, DD_H, DD_FLOOR, 0, 1)
              return (
                <div key={row.symbol} className="rounded-[10px] border border-bg-border bg-bg-card px-4 py-3.5 space-y-2">
                  <div className="flex justify-between items-baseline font-mono">
                    <span className="text-xs font-semibold text-ink-primary">{row.symbol}</span>
                    <span className="text-[15px] text-bear tabular-nums">{row.maxDrawdownPct != null ? `${row.maxDrawdownPct.toFixed(1)}%` : '—'}</span>
                  </div>
                  <svg viewBox={`0 0 ${DD_W} ${DD_H}`} preserveAspectRatio="none" className="block w-full h-16" aria-hidden>
                    {d && <path d={`${d}L${DD_W},0L0,0Z`} fill="rgba(239,68,68,.16)" />}
                    {d && <path d={d} fill="none" stroke={DOWN} strokeWidth={1.2} vectorEffect="non-scaling-stroke" />}
                  </svg>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Agenda */}
      <section className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] gap-10 pt-7 border-t border-bg-border">
        <div className="space-y-3">
          <Eyebrow>Agenda</Eyebrow>
          <p className="text-[22px] font-sans font-medium text-ink-primary">Próximos 7 días</p>
          <div className="inline-flex gap-1 p-[3px] border border-bg-border rounded-lg text-xs font-sans">
            {([['week', 'Semana'], ['month', 'Mes']] as const).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setAgendaView(id)}
                className={clsx('px-2.5 py-1.5 rounded-md transition-colors', agendaView === id ? 'bg-bg-border text-ink-primary' : 'text-ink-secondary hover:text-ink-primary')}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {agendaView === 'month' ? (
          <EconomicCalendar events={calendar} dailyPnl={dailyPnl} />
        ) : (
          <div>
            {agenda.map((g) => (
              <div key={g.day.toISOString()} className="grid grid-cols-[90px_minmax(0,1fr)] gap-5 py-3.5 border-t border-bg-border">
                <div className="space-y-0.5">
                  <p className={clsx('text-[13px] font-sans capitalize', g.isToday ? 'text-pulse' : 'text-ink-secondary')}>
                    {g.isToday ? 'Hoy' : g.day.toLocaleDateString('es-ES', { weekday: 'long' })}
                  </p>
                  <p className="text-[11px] font-mono text-ink-muted">{g.day.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</p>
                </div>
                <div className="space-y-2">
                  {g.items.length === 0 && <p className="text-[13px] font-sans text-ink-muted">Sin eventos de alto impacto.</p>}
                  {g.items.map((e) => (
                    <div key={e.id} className="grid grid-cols-[52px_10px_minmax(0,1fr)_auto] gap-2.5 items-center text-[13px]">
                      <span className="text-xs font-mono text-ink-secondary tabular-nums">
                        {new Date(e.datetime).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className={clsx('w-[7px] h-[7px] rounded-full', IMPACT_DOT[e.impact])} />
                      <span className="font-sans text-ink-primary truncate">{e.title}</span>
                      <span className="text-[11px] font-mono text-ink-secondary">{e.currency}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
