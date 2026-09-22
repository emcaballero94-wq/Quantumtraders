'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { clsx } from 'clsx'
import { useLocale } from '@/lib/i18n/LocaleProvider'
import { getActiveSessions } from '@/lib/oracle/timing-engine'
import { riskRegimeFromVix, computeAggregateBias } from '@/lib/oracle/risk-regime'
import { rankAssets } from '@/lib/oracle/score-engine'
import { GaugeMeter } from '@/components/ui/GaugeMeter'
import { RatingBadge, BiasBadge } from '@/components/ui/StatusBadge'
import type { RadarAsset, EconomicEvent, SectorStrength, EventImpact } from '@/lib/oracle/types'
import type { RelativeStrengthResult } from '@/lib/market-relative-strength'

interface OracleStateResponse {
  success: boolean
  data?: {
    radar: RadarAsset[]
    calendar: EconomicEvent[]
    sectorStrength: SectorStrength[]
  }
}

interface QuoteItem {
  symbol: string
  price: number | null
  changePct: number | null
}

interface QuoteResponse {
  quotes: QuoteItem[]
}

interface ApiTrade {
  id: string
  symbol: string
  side: 'BUY' | 'SELL'
  result: string
  profit: number
  createdAt: string
}

interface PulseBriefResponse {
  success: boolean
  data?: { brief: string }
  error?: string
}

const KEY_INSTRUMENTS = ['SPX500', 'NAS100', 'US30', 'XAUUSD', 'BTCUSD']

// Same computation Market State (Pulse) uses — summarized here, not duplicated logic.
const RS_BASE = 'XAUUSD'
const RS_SYMBOLS = ['SPX500', 'NAS100', 'US30', 'BTCUSD', 'USOIL']

interface RelativeStrengthResponse {
  success: boolean
  data?: RelativeStrengthResult
}

const IMPACT_DOT: Record<EventImpact, string> = { high: 'bg-bear', medium: 'bg-pulse', low: 'bg-oracle' }

export default function CommandPage() {
  const { t } = useLocale()
  const [radar, setRadar] = useState<RadarAsset[]>([])
  const [calendar, setCalendar] = useState<EconomicEvent[]>([])
  const [sectorStrength, setSectorStrength] = useState<SectorStrength[]>([])
  const [quotes, setQuotes] = useState<Record<string, QuoteItem>>({})
  const [trades, setTrades] = useState<ApiTrade[]>([])
  const [sessions, setSessions] = useState(() => getActiveSessions())
  const [rsResult, setRsResult] = useState<RelativeStrengthResult | null>(null)
  const [brief, setBrief] = useState<string | null>(null)
  const [briefError, setBriefError] = useState<string | null>(null)
  const [briefLoading, setBriefLoading] = useState(false)

  useEffect(() => {
    const id = setInterval(() => setSessions(getActiveSessions()), 60_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        const [statePayload, quotePayload, tradesPayload] = await Promise.all([
          fetch('/api/oracle/state').then((r) => r.json() as Promise<OracleStateResponse>),
          fetch(`/api/market/quote?symbols=VIX,${KEY_INSTRUMENTS.join(',')}`).then((r) => r.json() as Promise<QuoteResponse>),
          fetch('/api/journal/trades').then((r) => r.json()),
        ])
        if (!mounted) return
        setRadar(statePayload?.data?.radar ?? [])
        setCalendar(statePayload?.data?.calendar ?? [])
        setSectorStrength(statePayload?.data?.sectorStrength ?? [])

        const quoteMap: Record<string, QuoteItem> = {}
        for (const item of quotePayload?.quotes ?? []) quoteMap[item.symbol] = item
        setQuotes(quoteMap)

        setTrades(((tradesPayload?.data ?? []) as ApiTrade[]).slice(0, 5))
      } catch {
        if (!mounted) return
      }
    }
    load()
    const timer = setInterval(load, 60_000)
    return () => {
      mounted = false
      clearInterval(timer)
    }
  }, [])

  // Market State summary — same endpoint/computation the Market State page uses
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

  const vix = quotes.VIX?.price ?? null
  const riskRegime = riskRegimeFromVix(vix)
  const biasAgg = useMemo(() => computeAggregateBias(radar), [radar])
  const topOpportunities = useMemo(() => rankAssets(radar).slice(0, 4), [radar])
  const strongest = sectorStrength[0] ?? null
  const weakest = sectorStrength[sectorStrength.length - 1] ?? null

  const topMover = useMemo(() => {
    if (!rsResult) return null
    return [...rsResult.relativeStrength].sort((a, b) => (b.change90d ?? -999) - (a.change90d ?? -999))[0] ?? null
  }, [rsResult])

  const worstDrawdown = useMemo(() => {
    if (!rsResult) return null
    return [...rsResult.drawdown].sort((a, b) => (a.maxDrawdownPct ?? 0) - (b.maxDrawdownPct ?? 0))[0] ?? null
  }, [rsResult])

  const upcomingEvents = useMemo(() => {
    const now = Date.now()
    return [...calendar]
      .filter((e) => new Date(e.datetime).getTime() >= now)
      .sort((a, b) => a.datetime.localeCompare(b.datetime))
      .slice(0, 4)
  }, [calendar])

  useEffect(() => {
    if (!biasAgg) return
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
        relativeStrengthTop: [],
        drawdownWorst: [],
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
  }, [biasAgg, vix])

  return (
    <div className="space-y-5 animate-fade-in pb-20">
      <div>
        <p className="text-[10px] font-mono text-oracle uppercase tracking-[0.2em] mb-1">{t('command.kicker')}</p>
        <h1 className="text-lg font-mono font-bold text-ink-primary tracking-tight">{t('command.title')}</h1>
        <p className="text-xs font-mono text-ink-muted mt-1 max-w-xl">{t('command.subtitle')}</p>
      </div>

      {/* AI brief */}
      <div className="rounded-xl border border-oracle/30 bg-bg-card p-5 border-l-4 border-l-oracle space-y-2">
        <p className="text-[10px] font-mono text-oracle uppercase tracking-widest font-bold">AI Market Brief</p>
        {briefLoading && <p className="text-sm font-mono text-ink-dim">Generando resumen...</p>}
        {!briefLoading && brief && <p className="text-sm font-mono text-ink-primary leading-relaxed">{brief}</p>}
        {!briefLoading && !brief && <p className="text-xs font-mono text-ink-dim">{briefError ?? 'Esperando datos suficientes.'}</p>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Market regime + sessions */}
        <div className="rounded-xl border border-bg-border bg-bg-card p-5 space-y-4">
          <p className="text-[10px] font-mono text-ink-dim uppercase tracking-widest">Market Regime</p>
          <div className="flex items-center justify-between">
            <span className={clsx('text-xl font-mono font-bold', riskRegime.color)}>{riskRegime.label}</span>
            <div className="text-right">
              <p className="text-[8px] font-mono text-ink-dim uppercase tracking-widest">Volatility</p>
              <span className="text-xs font-mono text-ink-secondary">VIX <span className="text-ink-primary font-bold">{vix?.toFixed(1) ?? '—'}</span></span>
            </div>
          </div>
          <div className="border-t border-bg-border pt-3 space-y-1.5">
            <p className="text-[9px] font-mono text-ink-dim uppercase tracking-widest mb-1.5">Sessions</p>
            {sessions.map((s) => (
              <div key={s.name} className="flex items-center justify-between text-xs font-mono">
                <span className={clsx('flex items-center gap-2', s.isActive ? 'text-ink-primary font-bold' : 'text-ink-dim')}>
                  <span className={clsx('w-1.5 h-1.5 rounded-full', s.isActive ? 'bg-atlas animate-pulse-slow' : 'bg-bg-elevated')} />
                  {s.name}
                </span>
                <span className={s.isActive ? 'text-atlas' : 'text-ink-dim'}>{s.isActive ? 'Active' : 'Closed'}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bias agregado */}
        <div className="rounded-xl border border-bg-border bg-bg-card p-5 space-y-3">
          <p className="text-[10px] font-mono text-ink-dim uppercase tracking-widest">Bias</p>
          <div className="flex items-center justify-center">
            <GaugeMeter value={biasAgg?.avgScore ?? 0} />
          </div>
          {biasAgg && (
            <div className="flex items-center justify-center gap-3 text-[10px] font-mono">
              <span className="text-atlas font-bold">{biasAgg.bullish} ↑</span>
              <span className="text-bear font-bold">{biasAgg.bearish} ↓</span>
              <span className="text-ink-secondary font-bold">{biasAgg.neutral} →</span>
            </div>
          )}
        </div>

        {/* Key instruments */}
        <div className="rounded-xl border border-bg-border bg-bg-card p-5 space-y-2.5">
          <p className="text-[10px] font-mono text-ink-dim uppercase tracking-widest mb-1">Key Instruments</p>
          {KEY_INSTRUMENTS.map((symbol) => {
            const q = quotes[symbol]
            const up = (q?.changePct ?? 0) >= 0
            return (
              <Link key={symbol} href={`/dashboard/stock/${symbol}`} className="flex items-center justify-between hover:bg-bg-elevated/30 -mx-1 px-1 py-0.5 rounded transition-colors">
                <span className="text-xs font-mono font-bold text-ink-primary">{symbol}</span>
                <span className="flex items-center gap-2 text-xs font-mono">
                  <span className="text-ink-secondary">{q?.price?.toLocaleString('en-US', { maximumFractionDigits: symbol === 'BTCUSD' ? 0 : 2 }) ?? '—'}</span>
                  <span className={up ? 'text-atlas' : 'text-bear'}>{q?.changePct !== null && q?.changePct !== undefined ? `${up ? '+' : ''}${q.changePct.toFixed(2)}%` : '—'}</span>
                </span>
              </Link>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Scanner opportunities */}
        <div className="rounded-xl border border-bg-border bg-bg-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-mono text-ink-dim uppercase tracking-widest">Scanner Opportunities</p>
            <Link href="/dashboard/scanner" className="text-[10px] font-mono text-oracle hover:underline uppercase">View all →</Link>
          </div>
          <div className="space-y-2">
            {topOpportunities.length === 0 && <p className="text-xs font-mono text-ink-dim">Cargando radar...</p>}
            {topOpportunities.map((asset) => (
              <div key={asset.symbol} className="flex items-center justify-between px-3 py-2 rounded-lg border border-bg-border bg-bg-elevated/20">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-ink-primary">{asset.symbol}</span>
                  <BiasBadge bias={asset.bias} size="sm" />
                </div>
                <div className="flex items-center gap-2">
                  <RatingBadge rating={asset.rating} />
                  <span className="text-xs font-mono font-bold text-ink-primary tabular-nums w-8 text-right">{asset.totalScore}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Market State summary */}
        <div className="rounded-xl border border-bg-border bg-bg-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-mono text-ink-dim uppercase tracking-widest">Market State</p>
            <Link href="/dashboard/pulse" className="text-[10px] font-mono text-oracle hover:underline uppercase">View full →</Link>
          </div>
          <div className="space-y-2">
            {strongest && weakest ? (
              <>
                <div className="flex items-center justify-between px-3 py-2 rounded-lg border border-bg-border bg-bg-elevated/20">
                  <span className="text-[10px] font-mono text-ink-dim uppercase">Sector fuerte</span>
                  <span className="text-xs font-mono font-bold text-atlas">{strongest.sector} ({strongest.score})</span>
                </div>
                <div className="flex items-center justify-between px-3 py-2 rounded-lg border border-bg-border bg-bg-elevated/20">
                  <span className="text-[10px] font-mono text-ink-dim uppercase">Sector débil</span>
                  <span className="text-xs font-mono font-bold text-bear">{weakest.sector} ({weakest.score})</span>
                </div>
              </>
            ) : (
              <p className="text-xs font-mono text-ink-dim">Cargando sectores...</p>
            )}
            {topMover && (
              <div className="flex items-center justify-between px-3 py-2 rounded-lg border border-bg-border bg-bg-elevated/20">
                <span className="text-[10px] font-mono text-ink-dim uppercase">Mejor RS (90d)</span>
                <span className="text-xs font-mono font-bold text-atlas">
                  {topMover.symbol} {topMover.change90d !== null ? `${topMover.change90d >= 0 ? '+' : ''}${topMover.change90d.toFixed(1)}%` : '—'}
                </span>
              </div>
            )}
            {worstDrawdown && (
              <div className="flex items-center justify-between px-3 py-2 rounded-lg border border-bg-border bg-bg-elevated/20">
                <span className="text-[10px] font-mono text-ink-dim uppercase">Mayor drawdown</span>
                <span className="text-xs font-mono font-bold text-bear">
                  {worstDrawdown.symbol} {worstDrawdown.maxDrawdownPct !== null ? `${worstDrawdown.maxDrawdownPct.toFixed(1)}%` : '—'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Economic calendar */}
        <div className="rounded-xl border border-bg-border bg-bg-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-mono text-ink-dim uppercase tracking-widest">Economic Calendar</p>
            <Link href="/dashboard/pulse" className="text-[10px] font-mono text-oracle hover:underline uppercase">View full calendar →</Link>
          </div>
          <div className="space-y-1.5">
            {upcomingEvents.length === 0 && <p className="text-xs font-mono text-ink-dim">Sin eventos próximos.</p>}
            {upcomingEvents.map((ev) => (
              <div key={ev.id} className="flex items-center justify-between px-3 py-2 rounded-lg border border-bg-border bg-bg-elevated/20">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={clsx('w-1.5 h-1.5 rounded-full shrink-0', IMPACT_DOT[ev.impact])} />
                  <span className="text-[10px] font-mono text-ink-dim shrink-0">{ev.currency}</span>
                  <span className="text-xs font-mono text-ink-secondary truncate">{ev.title}</span>
                </div>
                <span className="text-[10px] font-mono text-ink-dim shrink-0 ml-2">
                  {new Date(ev.datetime).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent trade audit */}
      <div className="rounded-xl border border-bg-border bg-bg-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-mono text-ink-dim uppercase tracking-widest">Recent Trade Audit</p>
          <Link href="/dashboard/tools" className="text-[10px] font-mono text-oracle hover:underline uppercase">Open trade audit →</Link>
        </div>
        {trades.length === 0 ? (
          <p className="text-xs font-mono text-ink-dim">Aún no hay operaciones registradas.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="text-[9px] text-ink-dim uppercase tracking-wider border-b border-bg-border">
                  <th className="text-left py-2">Time</th>
                  <th className="text-left py-2">Symbol</th>
                  <th className="text-left py-2">Side</th>
                  <th className="text-right py-2">Result</th>
                </tr>
              </thead>
              <tbody>
                {trades.map((trade) => (
                  <tr key={trade.id} className="border-b border-bg-border/50">
                    <td className="py-2 text-ink-dim">{new Date(trade.createdAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="py-2 text-ink-primary font-bold">{trade.symbol}</td>
                    <td className="py-2 text-ink-secondary">{trade.side}</td>
                    <td className={clsx('py-2 text-right font-bold', trade.profit >= 0 ? 'text-atlas' : 'text-bear')}>
                      {trade.result === 'OPEN' ? 'Open' : `${trade.profit >= 0 ? '+' : ''}$${trade.profit.toFixed(0)}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
