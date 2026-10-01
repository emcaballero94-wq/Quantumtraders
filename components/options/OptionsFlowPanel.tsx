'use client'

import { useMemo, useState } from 'react'
import { clsx } from 'clsx'

export interface FlowLargeTrade {
  symbol: string
  optionType: 'CALL' | 'PUT'
  strike: number
  expiration: string
  dte: number
  contracts: number
  premium: number | null
  side: 'BUY' | 'SELL' | 'UNKNOWN'
  timestamp: number
  classification: { direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'UNKNOWN'; confidence: 'LOW' | 'MEDIUM' | 'HIGH'; reason: string }
}

export interface FlowKeyStrike {
  strike: number
  callPremium: number
  putPremium: number
  netDirectionalPressure: number
  shareOfTotalPremium: number
}

export interface FlowData {
  currency?: 'BTC' | 'ETH'
  tradeCount?: number
  totals?: { callPremium: number; putPremium: number; netPremium: number }
  directional?: { bullishPremium: number; bearishPremium: number; neutralPremium: number; unknownPremium: number }
  score?: { value: number; confidence: 'LOW' | 'MEDIUM' | 'HIGH'; dataQuality: 'GOOD' | 'DEGRADED'; components: Record<string, number> }
  acceleration?: {
    direction: 'INCREASING' | 'DECREASING' | 'FLAT'
    magnitudePct: number | null
    trackedDirection: 'BULLISH' | 'BEARISH'
    confidence: 'LOW' | 'MEDIUM' | 'HIGH'
    windowMinutes?: number
    previousPremium?: number
    currentPremium?: number
  }
  largeTrades?: FlowLargeTrade[]
  keyStrikes?: FlowKeyStrike[]
}

const CONF_LABEL = { LOW: 'baja', MEDIUM: 'media', HIGH: 'alta' } as const

function usd(v: number | null | undefined, signed = false) {
  if (v == null) return '—'
  const s = `$${Math.abs(v).toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 1 })}`
  return signed ? `${v >= 0 ? '+' : '−'}${s}` : s
}

const dirOf = (t: FlowLargeTrade) => t.classification.direction
const dirColor = (d: string) => (d === 'BULLISH' ? 'text-atlas' : d === 'BEARISH' ? 'text-bear' : 'text-ink-secondary')
const dirHex = (d: string) => (d === 'BULLISH' ? '#00C9A7' : d === 'BEARISH' ? '#EF4444' : '#8892A4')
const dirLabel = (d: string) => (d === 'BULLISH' ? 'Alcista' : d === 'BEARISH' ? 'Bajista' : 'Sin lado')
const signed = (t: FlowLargeTrade) => (dirOf(t) === 'BULLISH' ? 1 : dirOf(t) === 'BEARISH' ? -1 : 0) * (t.premium ?? 0)

export function OptionsFlowPanel({ flow, currency, underlyingPrice }: { flow: FlowData; currency: 'BTC' | 'ETH'; underlyingPrice: number | null }) {
  const [selected, setSelected] = useState(0)

  const bull = flow.directional?.bullishPremium ?? 0
  const bear = flow.directional?.bearishPremium ?? 0
  const net = bull - bear
  const lean: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = bull === bear ? 'NEUTRAL' : bull > bear ? 'BULLISH' : 'BEARISH'
  const leanText = lean === 'BULLISH' ? 'text-atlas' : lean === 'BEARISH' ? 'text-bear' : 'text-ink-primary'
  const ratio = bull && bear ? Math.max(bull, bear) / Math.min(bull, bear) : null
  const cpRatio = flow.totals && flow.totals.putPremium > 0 ? flow.totals.callPremium / flow.totals.putPremium : null
  const acc = flow.acceleration
  const accTracked = acc?.trackedDirection === 'BULLISH' ? 'alcista' : 'bajista'

  const trades = useMemo(() => [...(flow.largeTrades ?? [])].sort((a, b) => (b.premium ?? 0) - (a.premium ?? 0)), [flow.largeTrades])
  const sel = trades[selected] ?? null

  // Cumulative signed premium of large trades over time
  const chart = useMemo(() => {
    const byTime = [...trades].sort((a, b) => a.timestamp - b.timestamp)
    if (byTime.length === 0) return null
    const t0 = byTime[0].timestamp
    const t1 = byTime[byTime.length - 1].timestamp
    const span = Math.max(1, t1 - t0)
    let cum = 0
    const pts = byTime.map((t) => {
      cum += signed(t)
      return { t, x: ((t.timestamp - t0) / span) * 100, v: cum }
    })
    const vals = [0, ...pts.map((p) => p.v)]
    const max = Math.max(...vals)
    const min = Math.min(...vals)
    const range = max - min || 1
    const y = (v: number) => 8 + ((max - v) / range) * 84
    let d = `M0,${y(0)}`
    for (const p of pts) d += ` L${p.x},${y(p.v - signed(p.t))} L${p.x},${y(p.v)}`
    d += ` L100,${y(pts[pts.length - 1].v)}`
    return { pts: pts.map((p) => ({ ...p, y: y(p.v) })), d, zero: y(0), t0, t1 }
  }, [trades])

  const ladder = useMemo(() => [...(flow.keyStrikes ?? [])].sort((a, b) => b.strike - a.strike), [flow.keyStrikes])
  const ladderMax = Math.max(1, ...ladder.map((k) => Math.max(k.callPremium, k.putPremium)))
  const priceRowAfter = underlyingPrice != null ? ladder.findIndex((k) => k.strike < underlyingPrice) : -1

  const pushers = trades.filter((t) => dirOf(t) === lean)
  const pushersSum = pushers.reduce((a, t) => a + (t.premium ?? 0), 0)
  const topTwo = [...(flow.keyStrikes ?? [])].sort((a, b) => b.shareOfTotalPremium - a.shareOfTotalPremium).slice(0, 2)
  const topTwoShare = topTwo.reduce((a, k) => a + k.shareOfTotalPremium, 0)
  const bullCount = trades.filter((t) => dirOf(t) === 'BULLISH').length
  const bearCount = trades.filter((t) => dirOf(t) === 'BEARISH').length

  const summary = (() => {
    const parts: string[] = []
    if (ratio && lean !== 'NEUTRAL') parts.push(`Se operó ${ratio.toFixed(1)}× más prima ${lean === 'BULLISH' ? 'alcista que bajista' : 'bajista que alcista'}`)
    if (acc?.magnitudePct != null && acc.direction !== 'FLAT')
      parts.push(`en los últimos ${acc.windowMinutes ?? 15} min la prima ${accTracked} ${acc.direction === 'INCREASING' ? 'se aceleró' : 'se frenó'} un ${Math.abs(acc.magnitudePct).toFixed(0)}%`)
    if (topTwo.length === 2) parts.push(`el ${Math.round(topTwoShare * 100)}% de la prima está en ${topTwo.map((k) => k.strike.toLocaleString('en-US')).join(' y ')}`)
    if (parts.length === 0) return 'Flujo equilibrado: ningún lado domina por ahora.'
    const s = parts.join(', ')
    return s.charAt(0).toUpperCase() + s.slice(1) + '.'
  })()

  const time = (ts: number) => new Date(ts).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)]">
      {/* Verdict */}
      <div
        className="px-7 py-8 lg:border-r border-b lg:border-b-0 border-bg-border flex flex-col gap-5"
        style={{ background: `radial-gradient(300px 240px at 30% 20%, ${lean === 'BULLISH' ? 'rgba(0,201,167,0.10)' : lean === 'BEARISH' ? 'rgba(239,68,68,0.10)' : 'transparent'}, transparent 70%)` }}
      >
        <p className={clsx('text-[11px] font-mono uppercase tracking-[0.16em]', leanText)}>
          Options Flow · {currency}
          {underlyingPrice != null && <span className="text-ink-secondary normal-case tracking-normal"> · ${underlyingPrice.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>}
        </p>
        <div className="space-y-2.5">
          <p className="flex items-baseline gap-2.5">
            <span className={clsx('text-[80px] font-mono leading-[0.9] tracking-tighter tabular-nums', leanText)}>{flow.score?.value ?? '—'}</span>
            <span className="text-base font-mono text-ink-muted">/ 100</span>
          </p>
          <p className="text-[22px] font-sans font-semibold leading-tight text-ink-primary">
            {lean === 'NEUTRAL' ? 'Presión neutral' : `Presión ${lean === 'BULLISH' ? 'alcista' : 'bajista'}`}, confianza {CONF_LABEL[flow.score?.confidence ?? 'LOW']}
          </p>
          <p className="text-sm font-sans leading-relaxed text-ink-primary/80 text-pretty">{summary}</p>
          {flow.score?.dataQuality === 'DEGRADED' && <p className="text-xs font-sans text-pulse">Datos limitados: pocas operaciones clasificadas.</p>}
        </div>
        <div className="mt-auto pt-4 border-t border-bg-border space-y-1.5">
          <p className="text-[11px] font-mono uppercase tracking-[0.14em] text-ink-secondary">Muestra</p>
          <p className="text-xs font-sans text-ink-secondary">{flow.tradeCount ?? 0} trades recientes de Deribit · {trades.length} grandes (percentil 90)</p>
        </div>
      </div>

      {/* Detail */}
      <div className="px-7 py-7 flex flex-col gap-6 min-w-0">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="space-y-1">
            <p className="text-xs font-sans text-ink-secondary">Prima neta</p>
            <p className={clsx('text-[26px] font-mono tabular-nums', net >= 0 ? 'text-atlas' : 'text-bear')}>{usd(net, true)}</p>
            <p className="text-[11px] font-mono text-ink-muted">{usd(bull)} alcista · {usd(bear)} bajista</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-sans text-ink-secondary">Call / Put (por prima)</p>
            <p className="text-[26px] font-mono text-ink-primary tabular-nums">{cpRatio != null ? cpRatio.toFixed(2) : '—'}</p>
            {flow.totals && flow.totals.callPremium + flow.totals.putPremium > 0 && (
              <div className="flex h-[5px] gap-0.5 rounded-full overflow-hidden mt-1">
                <div className="bg-atlas" style={{ width: `${(flow.totals.callPremium / (flow.totals.callPremium + flow.totals.putPremium)) * 100}%` }} />
                <div className="flex-1 bg-bear" />
              </div>
            )}
          </div>
          <div className="space-y-1">
            <p className="text-xs font-sans text-ink-secondary">Aceleración {acc?.windowMinutes ?? 15} min</p>
            <p className={clsx('text-[26px] font-mono tabular-nums', acc?.trackedDirection === 'BULLISH' ? 'text-atlas' : 'text-bear')}>
              {acc?.magnitudePct != null ? `${acc.magnitudePct >= 0 ? '+' : ''}${acc.magnitudePct.toFixed(0)}%` : '—'}
            </p>
            <p className="text-[11px] font-mono text-ink-muted">prima {accTracked} vs {acc?.windowMinutes ?? 15} min previos</p>
          </div>
        </div>

        {chart && (
          <div className="space-y-2">
            <div className="flex justify-between gap-3">
              <p className="text-[11px] font-mono uppercase tracking-[0.14em] text-ink-secondary">Prima neta acumulada · operaciones grandes</p>
              <p className="text-[11px] font-mono text-ink-muted">cada punto es una operación</p>
            </div>
            <div className="relative h-[200px]">
              <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0" aria-hidden>
                <line x1="0" y1={chart.zero} x2="100" y2={chart.zero} stroke="#1A1F2E" strokeDasharray="1.5 1.5" vectorEffect="non-scaling-stroke" />
                <path d={chart.d} fill="none" stroke={net >= 0 ? '#00C9A7' : '#EF4444'} strokeWidth="2" vectorEffect="non-scaling-stroke" />
              </svg>
              {chart.pts.map((p) => {
                const idx = trades.indexOf(p.t)
                const active = idx === selected
                const size = 10 + ((p.t.premium ?? 0) / Math.max(1, trades[0]?.premium ?? 1)) * 12
                return (
                  <button
                    key={`${p.t.symbol}-${p.t.timestamp}`}
                    type="button"
                    onClick={() => setSelected(idx)}
                    aria-label={`${p.t.optionType} ${p.t.strike} ${usd(p.t.premium)}`}
                    className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
                    style={{
                      left: `${p.x}%`,
                      top: `${p.y}%`,
                      width: size,
                      height: size,
                      background: active ? '#F59E0B' : dirHex(dirOf(p.t)),
                      borderColor: active ? '#EEF0F5' : '#080B12',
                    }}
                  />
                )
              })}
              <span className="absolute left-0 -bottom-5 text-[10px] font-mono text-ink-muted">{time(chart.t0)}</span>
              <span className="absolute right-0 -bottom-5 text-[10px] font-mono text-ink-muted">{time(chart.t1)}</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] gap-7 pt-3">
          {/* Large trades */}
          <div className="flex flex-col min-w-0">
            <div className="flex justify-between pb-1.5">
              <p className="text-[11px] font-mono uppercase tracking-[0.14em] text-ink-secondary">Operaciones grandes</p>
              <p className="text-[10px] font-mono text-ink-muted">percentil 90</p>
            </div>
            {trades.length === 0 && <p className="text-[13px] font-sans text-ink-muted py-3">Sin operaciones grandes en la muestra.</p>}
            {trades.map((t, i) => (
              <button
                key={`${t.symbol}-${t.timestamp}`}
                type="button"
                onClick={() => setSelected(i)}
                aria-pressed={i === selected}
                className={clsx(
                  'grid grid-cols-[44px_minmax(0,1fr)_64px_64px] gap-2.5 items-center px-2 py-2 rounded-md text-left transition-colors',
                  i === selected ? 'bg-bg-card' : 'hover:bg-bg-card/60',
                )}
              >
                <span className="text-[11px] font-mono text-ink-secondary tabular-nums">{time(t.timestamp)}</span>
                <span className="text-[13px] font-sans text-ink-primary truncate">
                  <span className={clsx('font-mono font-semibold', t.optionType === 'PUT' ? 'text-bear' : 'text-atlas')}>{t.optionType}</span>{' '}
                  {t.side === 'BUY' ? 'compra' : t.side === 'SELL' ? 'venta' : '—'} · {t.strike.toLocaleString('en-US')} <span className="text-ink-muted">· {t.dte} DTE</span>
                </span>
                <span className="text-[13px] font-mono font-semibold text-right tabular-nums text-ink-primary">{usd(t.premium)}</span>
                <span className={clsx('text-[10px] font-mono uppercase text-right', dirColor(dirOf(t)))}>
                  {t.classification.confidence === 'LOW' ? 'conf. baja' : dirLabel(dirOf(t))}
                </span>
              </button>
            ))}
            {sel && (
              <p className="text-xs font-sans text-ink-secondary pt-2.5 px-2 text-pretty">
                <span className="text-ink-primary">{sel.contracts.toLocaleString('en-US')} contratos</span> · vence {sel.expiration} · {sel.classification.reason}
              </p>
            )}
          </div>

          {/* Calls · Strike · Puts */}
          <div className="flex flex-col gap-1">
            <div className="grid grid-cols-[minmax(0,1fr)_64px_minmax(0,1fr)] text-[10px] font-mono text-ink-muted pb-2">
              <span className="text-right">CALLS</span>
              <span className="text-center">STRIKE</span>
              <span>PUTS</span>
            </div>
            {ladder.length === 0 && <p className="text-[13px] font-sans text-ink-muted">Sin concentración relevante.</p>}
            {ladder.map((k, i) => {
              const hit = sel?.strike === k.strike
              return (
                <div key={k.strike}>
                  {i === priceRowAfter && underlyingPrice != null && (
                    <div className="flex items-center gap-2 py-1" aria-label="Precio actual">
                      <span className="flex-1 h-px bg-pulse/60" />
                      <span className="text-[10px] font-mono text-pulse">{underlyingPrice.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                      <span className="flex-1 h-px bg-pulse/60" />
                    </div>
                  )}
                  <div className={clsx('grid grid-cols-[minmax(0,1fr)_64px_minmax(0,1fr)] items-center h-9 rounded', hit && 'bg-pulse/[0.08]')}>
                    <div className="flex justify-end">
                      <div className="h-2.5 rounded-l-sm bg-atlas/85" style={{ width: `${(k.callPremium / ladderMax) * 100}%` }} title={usd(k.callPremium)} />
                    </div>
                    <span className={clsx('text-xs font-mono text-center tabular-nums', hit ? 'text-pulse' : 'text-ink-primary/85')}>
                      {k.strike.toLocaleString('en-US')}
                    </span>
                    <div className="flex items-center gap-2">
                      <div className="h-2.5 rounded-r-sm bg-bear/85" style={{ width: `${(k.putPremium / ladderMax) * 80}%` }} title={usd(k.putPremium)} />
                      <span className="text-[10px] font-mono text-ink-muted">{Math.round(k.shareOfTotalPremium * 100)}%</span>
                    </div>
                  </div>
                </div>
              )
            })}
            <p className="text-[11px] font-sans leading-relaxed text-ink-muted pt-2">Strike clave = donde hay más capital, no un soporte o resistencia confirmado.</p>
          </div>
        </div>

        {/* Evidence */}
        <div className="grid grid-cols-1 md:grid-cols-3 border-t border-bg-border pt-5 gap-6 md:gap-0">
          <div className="space-y-2.5 md:pr-6 md:border-r border-bg-border">
            <p className="text-[11px] font-mono uppercase tracking-[0.14em] text-ink-secondary">Quién empuja</p>
            <p className="text-sm font-sans leading-snug text-ink-primary text-pretty">
              {lean === 'NEUTRAL' || pushers.length === 0 ? (
                'Las operaciones grandes no tienen un lado claro.'
              ) : (
                <>
                  {pushers.length} de {trades.length} operaciones grandes son {lean === 'BULLISH' ? 'alcistas' : 'bajistas'} y suman <span className={leanText}>{usd(pushersSum)}</span>.
                </>
              )}
            </p>
            {trades.length > 0 && (
              <div className="flex h-1.5 gap-0.5 rounded-full overflow-hidden bg-bg-elevated">
                <div className="bg-atlas" style={{ width: `${(bullCount / trades.length) * 100}%` }} />
                <div className="bg-bear" style={{ width: `${(bearCount / trades.length) * 100}%` }} />
              </div>
            )}
          </div>
          <div className="space-y-2.5 md:px-6 md:border-r border-bg-border">
            <p className="text-[11px] font-mono uppercase tracking-[0.14em] text-ink-secondary">Dónde</p>
            <p className="text-sm font-sans leading-snug text-ink-primary text-pretty">
              {topTwo.length === 0 ? (
                'Sin concentración por strike.'
              ) : (
                <>
                  El <span className={leanText}>{Math.round(topTwoShare * 100)}%</span> de la prima está en{' '}
                  {topTwo.map((k) => `${k.strike.toLocaleString('en-US')} (${k.putPremium > k.callPremium ? 'puts' : 'calls'})`).join(' y ')}.
                </>
              )}
            </p>
          </div>
          <div className="space-y-2.5 md:pl-6">
            <p className="text-[11px] font-mono uppercase tracking-[0.14em] text-ink-secondary">Qué tan rápido</p>
            <p className="text-sm font-sans leading-snug text-ink-primary text-pretty">
              {acc?.magnitudePct == null ? (
                'Sin base de comparación en la ventana anterior.'
              ) : (
                <>
                  La prima {accTracked} de los últimos {acc.windowMinutes ?? 15} min {acc.magnitudePct >= 0 ? 'supera' : 'queda por debajo de'} la de los {acc.windowMinutes ?? 15} previos en{' '}
                  <span className={acc.trackedDirection === 'BULLISH' ? 'text-atlas' : 'text-bear'}>{Math.abs(acc.magnitudePct).toFixed(0)}%</span>.
                </>
              )}
            </p>
            {acc?.previousPremium != null && acc?.currentPremium != null && (
              <div className="space-y-1">
                {[
                  ['Previos', acc.previousPremium],
                  ['Últimos', acc.currentPremium],
                ].map(([l, v]) => (
                  <div key={l as string} className="grid grid-cols-[52px_minmax(0,1fr)_52px] gap-2 items-center text-[11px] font-mono">
                    <span className="text-ink-secondary">{l}</span>
                    <div className="h-1.5 rounded-full bg-bg-elevated">
                      <div
                        className={clsx('h-full rounded-full', acc.trackedDirection === 'BULLISH' ? 'bg-atlas' : 'bg-bear')}
                        style={{ width: `${((v as number) / Math.max(1, acc.previousPremium!, acc.currentPremium!)) * 100}%` }}
                      />
                    </div>
                    <span className="text-right text-ink-primary tabular-nums">{usd(v as number)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
