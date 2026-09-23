'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { clsx } from 'clsx'
import { useLocale } from '@/lib/i18n/LocaleProvider'
import { getActiveSessions } from '@/lib/oracle/timing-engine'
import { riskRegimeFromVix, computeAggregateBias } from '@/lib/oracle/risk-regime'
import { rankAssets } from '@/lib/oracle/score-engine'
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

const RS_BASE = 'XAUUSD'
const RS_SYMBOLS = ['SPX500', 'NAS100', 'US30', 'BTCUSD', 'USOIL']

interface RelativeStrengthResponse {
  success: boolean
  data?: RelativeStrengthResult
}

const IMPACT_DOT: Record<EventImpact, string> = { high: 'bg-bear', medium: 'bg-pulse', low: 'bg-oracle' }

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/** Session window as one or two [left%, width%] segments on a 24h UTC axis (wraps past midnight). */
function sessionSegments(openUTC: string, closeUTC: string): Array<[number, number]> {
  const o = toMin(openUTC)
  const c = toMin(closeUTC)
  const pct = (m: number) => (m / 1440) * 100
  if (c > o) return [[pct(o), pct(c - o)]]
  return [[0, pct(c)], [pct(o), 100 - pct(o)]]
}

function fmtCountdown(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h > 0 ? `${h} h ${m} min` : `${m} min`
}

function intensityWord(avg: number): string {
  if (avg >= 65) return 'fuerte'
  if (avg >= 45) return 'moderado'
  return 'débil'
}

function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={clsx('text-[11px] font-mono uppercase tracking-[0.16em]', className ?? 'text-ink-secondary')}>{children}</p>
}

function ColumnHeader({ title, href, cta }: { title: string; href?: string; cta?: string }) {
  return (
    <div className="flex items-center justify-between pb-2.5">
      <Eyebrow>{title}</Eyebrow>
      {href && cta && (
        <Link href={href} className="text-xs font-sans text-pulse hover:text-pulse/80 transition-colors">
          {cta} →
        </Link>
      )}
    </div>
  )
}

export default function CommandPage() {
  const { t } = useLocale()
  const [radar, setRadar] = useState<RadarAsset[]>([])
  const [calendar, setCalendar] = useState<EconomicEvent[]>([])
  const [sectorStrength, setSectorStrength] = useState<SectorStrength[]>([])
  const [quotes, setQuotes] = useState<Record<string, QuoteItem>>({})
  const [trades, setTrades] = useState<ApiTrade[]>([])
  const [sessions, setSessions] = useState(() => getActiveSessions())
  const [now, setNow] = useState(() => new Date())
  const [rsResult, setRsResult] = useState<RelativeStrengthResult | null>(null)
  const [brief, setBrief] = useState<string | null>(null)
  const [briefError, setBriefError] = useState<string | null>(null)
  const [briefLoading, setBriefLoading] = useState(false)

  useEffect(() => {
    const id = setInterval(() => {
      setSessions(getActiveSessions())
      setNow(new Date())
    }, 30_000)
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
    const ts = Date.now()
    return [...calendar]
      .filter((e) => new Date(e.datetime).getTime() >= ts)
      .sort((a, b) => a.datetime.localeCompare(b.datetime))
      .slice(0, 4)
  }, [calendar])

  const nowMin = now.getUTCHours() * 60 + now.getUTCMinutes()
  const nowPct = (nowMin / 1440) * 100

  const nextOpen = useMemo(() => {
    const closed = sessions.filter((s) => !s.isActive)
    if (closed.length === 0) return null
    return closed
      .map((s) => ({ name: s.name, mins: (toMin(s.openUTC) - nowMin + 1440) % 1440 }))
      .sort((a, b) => a.mins - b.mins)[0]
  }, [sessions, nowMin])

  const activeNames = sessions.filter((s) => s.isActive).map((s) => s.name)

  const biasPhrase = biasAgg
    ? biasAgg.label === 'Mixto'
      ? 'con sesgo mixto'
      : `con sesgo ${biasAgg.label.toLowerCase()} ${intensityWord(biasAgg.avgScore)}`
    : null

  const contextLine = [
    vix !== null ? `VIX ${vix.toFixed(1)}` : null,
    strongest && weakest ? `${strongest.sector} lidera y ${weakest.sector} es el sector más débil` : null,
    activeNames.length > 0 ? `Abiertas: ${activeNames.join(', ')}` : 'Todas las sesiones cerradas',
    nextOpen ? `${nextOpen.name} abre en ${fmtCountdown(nextOpen.mins)}` : null,
  ]
    .filter(Boolean)
    .join('. ')

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

  const briefMissingKey = briefError?.includes('ANTHROPIC_API_KEY')
  const biasPct = Math.max(0, Math.min(100, biasAgg?.avgScore ?? 50))

  return (
    <div className="space-y-9 animate-fade-in pb-20 max-w-[1280px]">
      {/* Hero: regime as a sentence + bias meter */}
      <section className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_400px] gap-8 xl:gap-12 items-end">
        <div className="space-y-3.5">
          <Eyebrow className="text-pulse">{t('command.kicker')}</Eyebrow>
          <h1 className="text-3xl md:text-[44px] font-sans font-medium leading-[1.15] tracking-tight text-ink-primary text-pretty">
            El mercado está en <span className={riskRegime.color}>{riskRegime.label}</span>
            {biasPhrase ? `, ${biasPhrase}.` : '.'}
          </h1>
          {contextLine && <p className="text-[15px] font-sans leading-relaxed text-ink-secondary max-w-2xl text-pretty">{contextLine}.</p>}
        </div>

        <div className="rounded-xl border border-bg-border bg-bg-card px-6 py-5 space-y-3.5">
          <div className="flex items-baseline justify-between">
            <span className="text-[13px] font-sans text-ink-secondary">Sesgo agregado</span>
            <span className="text-[28px] font-mono font-medium text-ink-primary tabular-nums">{biasAgg ? biasAgg.avgScore.toFixed(1) : '—'}</span>
          </div>
          <div className="relative h-2 rounded bg-gradient-to-r from-bear via-ink-muted to-atlas">
            <div className="absolute -top-[5px] h-[18px] w-[3px] rounded-sm bg-ink-primary -translate-x-1/2 transition-all" style={{ left: `${biasPct}%` }} />
          </div>
          <div className="flex justify-between text-[11px] font-mono text-ink-secondary">
            <span>Débil</span>
            <span>Moderado</span>
            <span>Fuerte</span>
          </div>
          {biasAgg && (
            <div className="flex gap-5 pt-2.5 border-t border-bg-border text-xs font-mono">
              <span className="text-atlas">{biasAgg.bullish} alcistas</span>
              <span className="text-bear">{biasAgg.bearish} bajistas</span>
              <span className="text-ink-secondary">{biasAgg.neutral} neutrales</span>
            </div>
          )}
        </div>
      </section>

      {/* Sessions timeline (UTC) */}
      <section className="space-y-2.5">
        <div className="flex justify-between text-[11px] font-mono text-ink-secondary">
          <span>SESIONES · UTC</span>
          <span className="text-ink-primary tabular-nums">
            {String(now.getUTCHours()).padStart(2, '0')}:{String(now.getUTCMinutes()).padStart(2, '0')} UTC
          </span>
        </div>
        <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-x-3 gap-y-1.5 items-center">
          {sessions.map((s) => (
            <div key={s.name} className="contents">
              <span className={clsx('text-xs font-sans', s.isActive ? 'text-ink-primary' : 'text-ink-secondary')}>{s.name}</span>
              <div className="relative h-3.5 rounded-[3px] bg-bg-card">
                {sessionSegments(s.openUTC, s.closeUTC).map(([l, w]) => (
                  <div
                    key={l}
                    className={clsx('absolute inset-y-0 rounded-[3px]', s.isActive ? 'bg-atlas' : 'bg-ink-dim')}
                    style={{ left: `${l}%`, width: `${w}%` }}
                  />
                ))}
                <div className="absolute -inset-y-1 w-0.5 bg-pulse" style={{ left: `${nowPct}%` }} />
              </div>
            </div>
          ))}
          <span />
          <div className="flex justify-between text-[10px] font-mono text-ink-muted">
            <span>00</span><span>06</span><span>12</span><span>18</span><span>24</span>
          </div>
        </div>
      </section>

      {/* Key instruments strip */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 rounded-xl border border-bg-border overflow-hidden gap-px bg-bg-border">
        {KEY_INSTRUMENTS.map((symbol) => {
          const q = quotes[symbol]
          const up = (q?.changePct ?? 0) >= 0
          return (
            <Link key={symbol} href={`/dashboard/stock/${symbol}`} className="bg-bg-card hover:bg-bg-elevated transition-colors px-[18px] py-4 space-y-2">
              <div className="flex items-baseline justify-between font-mono text-xs">
                <span className="font-semibold text-ink-primary">{symbol}</span>
                <span className={clsx('tabular-nums', up ? 'text-atlas' : 'text-bear')}>
                  {q?.changePct != null ? `${up ? '+' : ''}${q.changePct.toFixed(2)}%` : '—'}
                </span>
              </div>
              <p className="text-xl font-mono text-ink-primary tabular-nums">
                {q?.price?.toLocaleString('en-US', {
                  minimumFractionDigits: symbol === 'BTCUSD' ? 0 : 2,
                  maximumFractionDigits: symbol === 'BTCUSD' ? 0 : 2,
                }) ?? '—'}
              </p>
            </Link>
          )
        })}
      </section>

      {/* Opportunities · Market state · Agenda */}
      <section className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr_1fr] gap-8 lg:gap-10">
        <div>
          <ColumnHeader title="Oportunidades" href="/dashboard/scanner" cta="Ver scanner" />
          {topOpportunities.length === 0 && <p className="py-3 border-t border-bg-border text-sm font-sans text-ink-secondary">Cargando radar…</p>}
          {topOpportunities.map((asset) => (
            <Link
              key={asset.symbol}
              href={`/dashboard/stock/${asset.symbol}`}
              className="grid grid-cols-[76px_minmax(0,1fr)_40px] items-center gap-3.5 py-3 border-t border-bg-border hover:bg-bg-card/60 transition-colors"
            >
              <span className="text-sm font-mono font-semibold text-ink-primary">{asset.symbol}</span>
              <span className="flex items-center gap-2 min-w-0">
                <BiasBadge bias={asset.bias} size="sm" />
                <RatingBadge rating={asset.rating} />
              </span>
              <span className="text-base font-mono text-ink-primary text-right tabular-nums">{asset.totalScore}</span>
            </Link>
          ))}
        </div>

        <div>
          <ColumnHeader title="Estado del mercado" href="/dashboard/pulse" cta="Ver todo" />
          {!strongest && !topMover && <p className="py-3 border-t border-bg-border text-sm font-sans text-ink-secondary">Cargando…</p>}
          {strongest && (
            <StateRow label="Sector fuerte" value={`${strongest.sector} (${strongest.score})`} tone="up" />
          )}
          {weakest && <StateRow label="Sector débil" value={`${weakest.sector} (${weakest.score})`} tone="down" />}
          {topMover && (
            <StateRow
              label="Mejor RS (90D)"
              value={`${topMover.symbol} ${topMover.change90d != null ? `${topMover.change90d >= 0 ? '+' : ''}${topMover.change90d.toFixed(1)}%` : '—'}`}
              tone="up"
            />
          )}
          {worstDrawdown && (
            <StateRow
              label="Mayor drawdown"
              value={`${worstDrawdown.symbol} ${worstDrawdown.maxDrawdownPct != null ? `${worstDrawdown.maxDrawdownPct.toFixed(1)}%` : '—'}`}
              tone="down"
            />
          )}
        </div>

        <div>
          <ColumnHeader title="Agenda" href="/dashboard/pulse" cta="Calendario" />
          {upcomingEvents.length === 0 && <p className="py-3 border-t border-bg-border text-sm font-sans text-ink-secondary">Sin eventos próximos.</p>}
          {upcomingEvents.map((ev) => {
            const d = new Date(ev.datetime)
            return (
              <div key={ev.id} className="grid grid-cols-[52px_minmax(0,1fr)] gap-3 py-3 border-t border-bg-border">
                <span className="text-xs font-mono text-ink-secondary tabular-nums">
                  {d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="flex items-center gap-2 min-w-0">
                  <span className={clsx('w-1.5 h-1.5 rounded-full shrink-0', IMPACT_DOT[ev.impact])} />
                  <span className="text-[13px] font-sans text-ink-primary truncate">{ev.title}</span>
                  <span className="text-[11px] font-mono text-ink-secondary shrink-0">{ev.currency}</span>
                </span>
              </div>
            )
          })}
        </div>
      </section>

      {/* AI brief + trade audit */}
      <section className={clsx('grid grid-cols-1 gap-5', trades.length === 0 && 'md:grid-cols-2')}>
        <div className="rounded-xl border border-bg-border px-[22px] py-5 space-y-2">
          <Eyebrow className="text-oracle">Brief de IA</Eyebrow>
          {briefLoading && <p className="text-sm font-sans text-ink-secondary">Generando resumen…</p>}
          {!briefLoading && brief && <p className="text-[15px] font-sans leading-relaxed text-ink-primary text-pretty">{brief}</p>}
          {!briefLoading && !brief && (
            <>
              <p className="text-sm font-sans text-ink-primary">
                {briefMissingKey ? 'Desactivado — falta la clave de Anthropic.' : 'Sin resumen disponible todavía.'}
              </p>
              <p className="text-xs font-sans text-ink-secondary">
                {briefMissingKey ? 'Añade ANTHROPIC_API_KEY en las variables de entorno para recibir el resumen diario.' : briefError ?? 'Esperando datos suficientes.'}
              </p>
            </>
          )}
        </div>

        <div className="rounded-xl border border-bg-border px-[22px] py-5 space-y-2">
          <div className="flex items-center justify-between">
            <Eyebrow>Trade audit</Eyebrow>
            {trades.length > 0 && (
              <Link href="/dashboard/tools" className="text-xs font-sans text-pulse hover:text-pulse/80">Abrir →</Link>
            )}
          </div>
          {trades.length === 0 ? (
            <>
              <p className="text-sm font-sans text-ink-primary">Aún no hay operaciones registradas.</p>
              <Link href="/dashboard/tools" className="text-xs font-sans text-pulse hover:text-pulse/80">Registrar primera operación →</Link>
            </>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm font-mono tabular-nums">
                <thead>
                  <tr className="text-xs font-sans text-ink-secondary border-b border-bg-border">
                    <th className="text-left font-normal py-2.5">Hora</th>
                    <th className="text-left font-normal py-2.5">Símbolo</th>
                    <th className="text-left font-normal py-2.5">Lado</th>
                    <th className="text-right font-normal py-2.5">Resultado</th>
                  </tr>
                </thead>
                <tbody>
                  {trades.map((trade) => (
                    <tr key={trade.id} className="border-b border-bg-border/50">
                      <td className="py-2.5 text-ink-secondary">{new Date(trade.createdAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</td>
                      <td className="py-2.5 text-ink-primary font-semibold">{trade.symbol}</td>
                      <td className="py-2.5 text-ink-secondary">{trade.side}</td>
                      <td className={clsx('py-2.5 text-right', trade.profit >= 0 ? 'text-atlas' : 'text-bear')}>
                        {trade.result === 'OPEN' ? 'Abierta' : `${trade.profit >= 0 ? '+' : ''}$${trade.profit.toFixed(0)}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

function StateRow({ label, value, tone }: { label: string; value: string; tone: 'up' | 'down' }) {
  return (
    <div className="py-2.5 border-t border-bg-border space-y-0.5">
      <p className="text-xs font-sans text-ink-secondary">{label}</p>
      <p className={clsx('text-sm font-mono', tone === 'up' ? 'text-atlas' : 'text-bear')}>{value}</p>
    </div>
  )
}
