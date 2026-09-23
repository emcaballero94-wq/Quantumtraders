'use client'

import { useEffect, useMemo, useState } from 'react'
import { clsx } from 'clsx'
import { NumberedSection } from '@/components/ui/NumberedSection'
import { GaugeMeter } from '@/components/ui/GaugeMeter'
import { Sparkline } from '@/components/ui/Sparkline'
import { MultiLineChart, type ChartSeries } from '@/components/pulse/MultiLineChart'
import { EconomicCalendar, type DayPnl } from '@/components/pulse/EconomicCalendar'
import type { SectorStrength, EconomicEvent, RadarAsset } from '@/lib/oracle/types'
import type { RelativeStrengthResult } from '@/lib/market-relative-strength'
import { riskRegimeFromVix, computeAggregateBias } from '@/lib/oracle/risk-regime'

interface OracleStateResponse {
  success: boolean
  data?: {
    sectorStrength: SectorStrength[]
    calendar: EconomicEvent[]
    radar: RadarAsset[]
  }
}

interface JournalTrade {
  createdAt: string
  profit: number
  commission: number
  swap: number
  result: string
}

interface QuoteItem {
  symbol: string
  price: number | null
  changePct: number | null
  high: number | null
  low: number | null
}

interface QuoteResponse {
  quotes: QuoteItem[]
}

interface HistoryResponseItem {
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

const INSTRUMENTS = [
  { symbol: 'SPX500', label: 'S&P 500' },
  { symbol: 'NAS100', label: 'Nasdaq 100' },
  { symbol: 'US30', label: 'Dow Jones' },
  { symbol: 'USOIL', label: 'WTI Crude' },
  { symbol: 'XAUUSD', label: 'Oro' },
  { symbol: 'BTCUSD', label: 'Bitcoin' },
]

const RS_BASE = 'XAUUSD'
const RS_SYMBOLS = ['SPX500', 'NAS100', 'US30', 'BTCUSD', 'USOIL']
const RS_COLORS: Record<string, string> = {
  SPX500: '#7C3AED',
  NAS100: '#E8B44C',
  US30: '#10B981',
  BTCUSD: '#F97316',
  USOIL: '#EF4444',
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function fmtPct(value: number | null): string {
  if (value === null) return '—'
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`
}

export default function PulsePage() {
  const [sectorStrength, setSectorStrength] = useState<SectorStrength[]>([])
  const [calendar, setCalendar] = useState<EconomicEvent[]>([])
  const [radar, setRadar] = useState<RadarAsset[]>([])
  const [trades, setTrades] = useState<JournalTrade[]>([])
  const [quotes, setQuotes] = useState<Record<string, QuoteItem>>({})
  const [sparklines, setSparklines] = useState<Record<string, number[]>>({})
  const [rsResult, setRsResult] = useState<RelativeStrengthResult | null>(null)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [brief, setBrief] = useState<string | null>(null)
  const [briefError, setBriefError] = useState<string | null>(null)
  const [briefLoading, setBriefLoading] = useState(false)

  useEffect(() => {
    let mounted = true
    const fetchData = async () => {
      try {
        const instrumentSymbols = INSTRUMENTS.map((i) => i.symbol).join(',')
        const [statePayload, quotePayload, tradesPayload, ...sparklinePayloads] = await Promise.all([
          fetch('/api/oracle/state').then((r) => r.json() as Promise<OracleStateResponse>),
          fetch(`/api/market/quote?symbols=VIX,${instrumentSymbols}`).then((r) => r.json() as Promise<QuoteResponse>),
          fetch('/api/journal/trades').then((r) => r.json()),
          ...INSTRUMENTS.map((i) =>
            fetch(`/api/market/history?symbol=${i.symbol}&interval=1h&outputsize=48`).then((r) => r.json() as Promise<HistoryResponseItem[]>),
          ),
        ])
        if (!mounted) return

        setSectorStrength(statePayload?.data?.sectorStrength ?? [])
        setCalendar(statePayload?.data?.calendar ?? [])
        setRadar(statePayload?.data?.radar ?? [])
        setTrades((tradesPayload?.data ?? []) as JournalTrade[])

        const quoteMap: Record<string, QuoteItem> = {}
        for (const item of quotePayload?.quotes ?? []) quoteMap[item.symbol] = item
        setQuotes(quoteMap)

        const sparkMap: Record<string, number[]> = {}
        INSTRUMENTS.forEach((instrument, idx) => {
          const history = sparklinePayloads[idx]
          sparkMap[instrument.symbol] = (Array.isArray(history) ? history : [])
            .map((c) => c.close)
            .filter((v): v is number => Number.isFinite(v))
        })
        setSparklines(sparkMap)

        setLastUpdated(new Date().toISOString())
      } catch {
        if (!mounted) return
      }
    }

    fetchData()
    const timer = setInterval(fetchData, 60_000)
    return () => {
      mounted = false
      clearInterval(timer)
    }
  }, [])

  // Relative strength / drawdown — daily history, fetched once (server-cached 5min)
  useEffect(() => {
    let mounted = true
    fetch(`/api/market/relative-strength?symbols=${RS_SYMBOLS.join(',')}&base=${RS_BASE}`)
      .then((r) => r.json() as Promise<RelativeStrengthResponse>)
      .then((payload) => {
        if (!mounted) return
        if (payload.success && payload.data) setRsResult(payload.data)
      })
      .catch(() => {})
    return () => {
      mounted = false
    }
  }, [])

  const strongest = sectorStrength[0] ?? null
  const weakest = sectorStrength[sectorStrength.length - 1] ?? null
  const vix = quotes.VIX?.price ?? null
  const riskRegime = riskRegimeFromVix(vix)

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

  // ── 01 Bias agregado — derivado del motor de scoring real (radar), no de order flow ──
  const biasAgg = useMemo(() => computeAggregateBias(radar), [radar])

  // ── 05/06 Relative strength & drawdown chart series ──
  const rsChartSeries: ChartSeries[] = useMemo(() => {
    if (!rsResult) return []
    return rsResult.relativeStrength.map((row) => ({
      symbol: row.symbol,
      color: RS_COLORS[row.symbol] ?? '#94A3B8',
      points: row.series,
    }))
  }, [rsResult])

  const drawdownChartSeries: ChartSeries[] = useMemo(() => {
    if (!rsResult) return []
    return rsResult.drawdown.map((row) => ({
      symbol: row.symbol,
      color: RS_COLORS[row.symbol] ?? '#94A3B8',
      points: row.series,
    }))
  }, [rsResult])

  const rsTopRanked = useMemo(
    () => (rsResult ? [...rsResult.relativeStrength].sort((a, b) => (b.change90d ?? -999) - (a.change90d ?? -999)) : []),
    [rsResult],
  )

  const drawdownWorst = useMemo(
    () => (rsResult ? [...rsResult.drawdown].sort((a, b) => (a.maxDrawdownPct ?? 0) - (b.maxDrawdownPct ?? 0)) : []),
    [rsResult],
  )

  // ── 07 AI live summary — real Claude call over the real computed metrics above ──
  useEffect(() => {
    if (!biasAgg || !rsResult || sectorStrength.length === 0) return
    let mounted = true
    setBriefLoading(true)
    fetch('/api/market/pulse-brief', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        biasLabel: biasAgg.label,
        biasIntensity: biasAgg.avgScore,
        bullishCount: biasAgg.bullish,
        bearishCount: biasAgg.bearish,
        neutralCount: biasAgg.neutral,
        vixLabel: riskRegime.label,
        vix,
        strongestSector: strongest?.sector ?? null,
        weakestSector: weakest?.sector ?? null,
        relativeStrengthTop: rsTopRanked.slice(0, 2).map((r) => ({ symbol: r.symbol, change90d: r.change90d })),
        drawdownWorst: drawdownWorst.slice(0, 2).map((d) => ({ symbol: d.symbol, maxDrawdownPct: d.maxDrawdownPct })),
      }),
    })
      .then((r) => r.json() as Promise<PulseBriefResponse>)
      .then((payload) => {
        if (!mounted) return
        if (payload.success && payload.data) {
          setBrief(payload.data.brief)
          setBriefError(null)
        } else {
          setBrief(null)
          setBriefError(payload.error ?? 'Resumen de IA no disponible')
        }
      })
      .catch(() => {
        if (!mounted) return
        setBrief(null)
        setBriefError('Resumen de IA no disponible')
      })
      .finally(() => {
        if (mounted) setBriefLoading(false)
      })
    return () => {
      mounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [biasAgg, rsResult, sectorStrength.length])

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="flex items-center justify-between border border-bg-border bg-bg-card rounded-xl px-5 py-3 flex-wrap gap-2">
        <div className="flex items-center gap-4">
          <span className="font-mono font-bold text-ink-primary text-xs tracking-wider">PULSE · Live Regime</span>
          <span className="text-ink-secondary text-xs font-mono">
            {lastUpdated ? `Actualizado ${new Date(lastUpdated).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}` : 'Inicializando feed'}
          </span>
        </div>
        <div className={`text-xs font-bold font-mono ${riskRegime.color}`}>{riskRegime.label} ({riskRegime.score})</div>
      </div>

      {/* 07 — AI live summary */}
      <div className="rounded-xl border border-oracle/30 bg-bg-card p-5 border-l-4 border-l-oracle space-y-2">
        <NumberedSection number="07" title="Resumen en vivo · generado por IA" accent="oracle" />
        {briefLoading && <p className="text-sm font-mono text-ink-dim">Generando resumen...</p>}
        {!briefLoading && brief && <p className="text-sm font-mono text-ink-primary leading-relaxed">{brief}</p>}
        {!briefLoading && !brief && <p className="text-xs font-mono text-ink-dim">{briefError ?? 'Esperando datos suficientes para generar el resumen.'}</p>}
      </div>

      {/* 01 — Bias agregado */}
      <div className="rounded-xl border border-bg-border bg-bg-card p-5">
        <NumberedSection
          number="01"
          title="Bias agregado"
          subtitle="Derivado del motor de scoring (macro + técnico + timing) — no de order flow"
          accent="pulse"
          className="mb-4"
        />
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6 items-center">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className={clsx(
                'text-2xl font-mono font-bold',
                biasAgg ? (biasAgg.label === 'Alcista' ? 'text-atlas' : biasAgg.label === 'Bajista' ? 'text-bear' : 'text-pulse') : 'text-ink-dim',
              )}>
                {biasAgg ? (biasAgg.label === 'Alcista' ? '↑ Alcista' : biasAgg.label === 'Bajista' ? '↓ Bajista' : '→ Mixto') : 'Cargando...'}
              </span>
              {biasAgg && (
                <span className={clsx(
                  'text-[10px] font-mono uppercase px-2 py-0.5 rounded-full border',
                  biasAgg.aligned ? 'text-atlas border-atlas/30 bg-atlas/10' : 'text-pulse border-pulse/30 bg-pulse/10',
                )}>
                  {biasAgg.aligned ? 'Alineado' : 'Mixto'}
                </span>
              )}
            </div>
            {biasAgg && (
              <div className="flex items-center gap-4 text-xs font-mono">
                <span className="text-atlas font-bold">{biasAgg.bullish} alcistas</span>
                <span className="text-bear font-bold">{biasAgg.bearish} bajistas</span>
                <span className="text-ink-secondary font-bold">{biasAgg.neutral} neutrales</span>
              </div>
            )}
            <p className="text-[10px] font-mono text-ink-dim">de {radar.length} activos analizados por el radar del Scanner</p>
          </div>
          <GaugeMeter value={biasAgg?.avgScore ?? 0} />
        </div>
      </div>

      {/* 02 — Instrumentos */}
      <div className="rounded-xl border border-bg-border bg-bg-card p-5 space-y-4">
        <NumberedSection number="02" title="Instrumentos" subtitle="Precio en vivo · posición en el rango del día" accent="pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {INSTRUMENTS.map((instrument) => {
            const q = quotes[instrument.symbol]
            const up = (q?.changePct ?? 0) >= 0
            const rangePct = q?.high !== null && q?.high !== undefined && q?.low !== null && q?.low !== undefined && q.high > q.low && q?.price !== null && q?.price !== undefined
              ? clamp(((q.price - q.low) / (q.high - q.low)) * 100, 0, 100)
              : null
            return (
              <div key={instrument.symbol} className="rounded-lg border border-bg-border bg-bg-elevated/20 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-mono font-bold text-ink-primary">{instrument.symbol}</p>
                    <p className="text-[9px] font-mono text-ink-dim">{instrument.label}</p>
                  </div>
                  <span className={clsx('text-[9px] font-mono uppercase px-2 py-0.5 rounded-full border', up ? 'text-atlas border-atlas/30 bg-atlas/10' : 'text-bear border-bear/30 bg-bear/10')}>
                    {up ? 'Alcista' : 'Bajista'}
                  </span>
                </div>
                <p className="text-lg font-mono font-bold text-ink-primary tabular-nums">
                  {q?.price !== null && q?.price !== undefined ? q.price.toLocaleString('en-US', { maximumFractionDigits: instrument.symbol === 'BTCUSD' ? 0 : 2 }) : '—'}
                  <span className={clsx('text-xs ml-2', up ? 'text-atlas' : 'text-bear')}>
                    {q?.changePct !== null && q?.changePct !== undefined ? `${up ? '+' : ''}${q.changePct.toFixed(2)}%` : ''}
                  </span>
                </p>
                <Sparkline values={sparklines[instrument.symbol] ?? []} up={up} />
                {rangePct !== null && (
                  <div className="space-y-1">
                    <div className="w-full h-1.5 bg-bg-deep rounded-full overflow-hidden relative">
                      <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-bear via-pulse to-atlas w-full opacity-30" />
                      <div className="absolute h-full w-0.5 bg-ink-primary" style={{ left: `${rangePct}%` }} />
                    </div>
                    <div className="flex justify-between text-[8px] font-mono text-ink-dim">
                      <span>Mín {q?.low?.toFixed(2) ?? '—'}</span>
                      <span>Máx {q?.high?.toFixed(2) ?? '—'}</span>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Risk meter + Sector ranking */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-xl border border-bg-border bg-bg-card p-6 flex flex-col space-y-4">
          <div className="flex items-center justify-between">
            <NumberedSection number="03" title="Risk meter (VIX)" accent="pulse" />
            <span className="text-[10px] font-mono text-ink-dim">Fuente: Yahoo Finance</span>
          </div>
          <div className="space-y-3">
            <div className="w-full h-3 bg-bg-elevated rounded-full overflow-hidden">
              <div className={`h-full ${riskRegime.score >= 70 ? 'bg-atlas' : riskRegime.score <= 35 ? 'bg-bear' : 'bg-oracle'}`} style={{ width: `${riskRegime.score}%` }} />
            </div>
            <p className="text-xs font-mono text-ink-secondary">
              VIX: <span className="text-ink-primary font-bold">{vix?.toFixed(2) ?? '--'}</span> · Régimen: <span className={riskRegime.color}>{riskRegime.label}</span>
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-bg-border bg-bg-card p-6 space-y-4">
          <NumberedSection number="04" title="Ranking sectorial" subtitle="Derivado de sector ETFs en tiempo real" accent="pulse" />
          <div className="space-y-3 pt-1">
            {sectorStrength.map((item, index) => {
              const normalized = clamp(Math.round(((item.score + 100) / 200) * 100), 0, 100)
              return (
                <div key={item.sector} className="flex items-center gap-3 text-xs font-mono">
                  <span className="text-ink-secondary font-bold w-4">#{index + 1}</span>
                  <span className="text-ink-primary font-bold w-32 truncate">{item.sector}</span>
                  <div className="flex-1 bg-bg-elevated h-2 rounded-full overflow-hidden">
                    <div className={`h-full ${item.score >= 0 ? 'bg-atlas' : 'bg-bear'}`} style={{ width: `${normalized}%` }} />
                  </div>
                  <span className={`w-10 text-right font-bold ${item.score >= 0 ? 'text-atlas' : 'text-bear'}`}>{item.score}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* 05 — Relative strength */}
      <div className="rounded-xl border border-bg-border bg-bg-card p-5 space-y-4">
        <NumberedSection number="05" title="Relative strength" subtitle={`vs ${RS_BASE} (oro) · normalizado a 100`} accent="pulse" />
        {rsChartSeries.length > 0 ? (
          <>
            <MultiLineChart series={rsChartSeries} />
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="text-[9px] text-ink-dim uppercase tracking-wider border-b border-bg-border">
                    <th className="text-left py-2">Símbolo</th>
                    <th className="text-right py-2">20d</th>
                    <th className="text-right py-2">60d</th>
                    <th className="text-right py-2">90d</th>
                    <th className="text-right py-2">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {rsTopRanked.map((row) => (
                    <tr key={row.symbol} className="border-b border-bg-border/50">
                      <td className="py-2 text-ink-primary font-bold" style={{ color: RS_COLORS[row.symbol] }}>{row.symbol}</td>
                      <td className={clsx('py-2 text-right font-bold', (row.change20d ?? 0) >= 0 ? 'text-atlas' : 'text-bear')}>{fmtPct(row.change20d)}</td>
                      <td className={clsx('py-2 text-right font-bold', (row.change60d ?? 0) >= 0 ? 'text-atlas' : 'text-bear')}>{fmtPct(row.change60d)}</td>
                      <td className={clsx('py-2 text-right font-bold', (row.change90d ?? 0) >= 0 ? 'text-atlas' : 'text-bear')}>{fmtPct(row.change90d)}</td>
                      <td className="py-2 text-right text-ink-primary font-bold">{row.score}/3</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="text-xs font-mono text-ink-dim">Cargando fuerza relativa...</p>
        )}
      </div>

      {/* 06 — Drawdown / Risk regime */}
      <div className="rounded-xl border border-bg-border bg-bg-card p-5 space-y-4">
        <NumberedSection number="06" title="Drawdown / Risk regime" subtitle="Caída acumulada desde el máximo (6 meses)" accent="pulse" />
        {drawdownChartSeries.length > 0 ? (
          <>
            <MultiLineChart series={drawdownChartSeries} />
            <div className="flex flex-wrap gap-3 pt-1">
              {drawdownWorst.map((row) => (
                <div key={row.symbol} className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-bg-border bg-bg-elevated/20">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: RS_COLORS[row.symbol] ?? '#94A3B8' }} />
                  <span className="text-xs font-mono font-bold text-ink-primary">{row.symbol}</span>
                  <span className="text-xs font-mono text-bear font-bold">{fmtPct(row.maxDrawdownPct)}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-xs font-mono text-ink-dim">Cargando drawdown...</p>
        )}
      </div>

      <EconomicCalendar events={calendar} dailyPnl={dailyPnl} />

      <div className="rounded-xl border border-oracle/30 bg-bg-card p-6 border-l-4 border-l-oracle space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-oracle uppercase font-bold tracking-widest">Lectura del Oráculo</span>
        </div>
        <p className="text-sm font-mono text-ink-primary leading-relaxed">
          {strongest && weakest
            ? `${strongest.sector} es el sector más fuerte (${strongest.score}) y ${weakest.sector} el más débil (${weakest.score}). La divergencia de ${Math.abs(strongest.score - weakest.score)} puntos sugiere vigilar rotación sectorial.`
            : 'Esperando datos de fuerza sectorial para generar lectura contextual.'}
        </p>
      </div>

      <p className="text-[10px] font-mono text-ink-dim text-center">
        Flujo de órdenes y profundidad de mercado (nivel 2) no disponibles — requieren un feed institucional que esta plataforma no tiene conectado.
      </p>
    </div>
  )
}
