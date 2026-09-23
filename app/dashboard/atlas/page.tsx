'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { clsx } from 'clsx'
import { useTVQuote } from '@/hooks/useTVQuote'
import { MarketNewsPanel } from '@/components/pulse/MarketNewsPanel'
import type { OracleAlert, RadarAsset } from '@/lib/oracle/types'

const TradingViewChart = dynamic(() => import('@/components/atlas/TradingViewChart').then((m) => m.TradingViewChart), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-bg-deep">
      <div className="flex flex-col items-center gap-3">
        <div className="w-7 h-7 border-2 border-atlas border-t-transparent rounded-full animate-spin" />
        <span className="text-[10px] font-mono text-atlas uppercase tracking-[0.2em]">Conectando con TradingView…</span>
      </div>
    </div>
  ),
})

const SYMBOLS = ['SPX500', 'NAS100', 'US30', 'NVDA', 'MSFT', 'GOOGL', 'AMZN', 'META', 'AVGO', 'TSM', 'AMD', 'MU', 'TSLA', 'PLTR', 'BTCUSD', 'XAUUSD']

const TIMEFRAMES = [
  { label: 'M1', value: '1' },
  { label: 'M5', value: '5' },
  { label: 'M15', value: '15' },
  { label: 'M30', value: '30' },
  { label: 'H1', value: '60' },
  { label: 'H4', value: '240' },
  { label: 'D1', value: 'D' },
  { label: 'W1', value: 'W' },
]

const DISPLAY_NAME: Record<string, string> = {
  SPX500: 'S&P 500',
  NAS100: 'Nasdaq 100',
  US30: 'Dow 30',
  BTCUSD: 'BTC/USDT',
  XAUUSD: 'XAU/USD',
}

const RATING_LABEL: Record<string, string> = { strong: 'Fuerte', operable: 'Operable', mixed: 'Mixto', avoid: 'Evitar' }
const BIAS_LABEL: Record<string, string> = { bullish: '▲ alcista', bearish: '▼ bajista', neutral: '● neutral' }

function fmt(price: number | null | undefined, symbol: string) {
  if (price == null) return '—'
  const d = symbol === 'BTCUSD' ? 0 : 2
  return price.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
}

function fmtPct(v: number | null | undefined) {
  if (v == null) return '—'
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`
}

const scoreText = (v: number) => (v >= 70 ? 'text-atlas' : v >= 50 ? 'text-oracle' : v >= 30 ? 'text-pulse' : 'text-bear')

export default function AtlasPage() {
  const [symbol, setSymbol] = useState('SPX500')
  const [interval, setInterval_] = useState('60')
  const [alerts, setAlerts] = useState<OracleAlert[]>([])
  const [radar, setRadar] = useState<RadarAsset[]>([])
  const [prevPrice, setPrevPrice] = useState<number | null>(null)
  const [flash, setFlash] = useState<'up' | 'down' | null>(null)

  // Deep link: ?symbol=NVDA from Scanner / Command
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('symbol')?.toUpperCase()
    if (requested && SYMBOLS.includes(requested)) setSymbol(requested)
  }, [])

  const { quotes, loading: quoteLoading, error: quoteError } = useTVQuote(SYMBOLS, 3000)
  const quote = quotes[symbol] ?? null

  useEffect(() => {
    if (!quote?.price) return
    if (prevPrice != null && quote.price !== prevPrice) {
      setFlash(quote.price > prevPrice ? 'up' : 'down')
      const t = setTimeout(() => setFlash(null), 600)
      setPrevPrice(quote.price)
      return () => clearTimeout(t)
    }
    setPrevPrice(quote.price)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quote?.price])

  useEffect(() => setPrevPrice(null), [symbol])

  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        const [alertsPayload, statePayload] = await Promise.all([
          fetch('/api/oracle/alerts').then((r) => r.json()),
          fetch('/api/oracle/state').then((r) => r.json()),
        ])
        if (!mounted) return
        setAlerts(alertsPayload?.data ?? [])
        setRadar(statePayload?.data?.radar ?? [])
      } catch {
        if (!mounted) return
        setAlerts([])
      }
    }
    load()
    const timer = setInterval(load, 60_000)
    return () => {
      mounted = false
      clearInterval(timer)
    }
  }, [])

  const zones = useMemo(
    () => alerts.filter((a) => a.symbol === symbol && a.priceZone).map((a) => ({ ...a.priceZone!, critical: a.severity === 'critical' })),
    [alerts, symbol],
  )
  const asset = radar.find((a) => a.symbol === symbol) ?? null
  const up = (quote?.changePct ?? 0) >= 0
  const rangePct =
    quote?.high != null && quote?.low != null && quote?.price != null && quote.high > quote.low
      ? Math.max(0, Math.min(100, ((quote.price - quote.low) / (quote.high - quote.low)) * 100))
      : null
  const maxAbsPct = Math.max(0.5, ...SYMBOLS.map((s) => Math.abs(quotes[s]?.changePct ?? 0)))
  const sum = asset ? asset.macroScore + asset.technicalScore + asset.timingScore || 1 : 1

  return (
    <div className="animate-fade-in">
      <div
        className="rounded-xl border border-bg-border bg-bg-deep overflow-hidden grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)_290px] font-mono"
        style={{ height: 'calc(100vh - 110px)', minHeight: 620 }}
      >
        {/* Watchlist */}
        <nav className="hidden lg:flex flex-col min-h-0 border-r border-bg-border" aria-label="Watchlist">
          <p className="px-4 py-3.5 text-[10px] tracking-[0.14em] text-ink-secondary border-b border-bg-border">WATCHLIST</p>
          <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0">
            {SYMBOLS.map((s) => {
              const q = quotes[s]
              const pct = q?.changePct ?? null
              const active = s === symbol
              const pUp = (pct ?? 0) >= 0
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSymbol(s)}
                  aria-pressed={active}
                  className={clsx(
                    'w-full grid grid-cols-[minmax(0,1fr)_auto] gap-x-2 gap-y-1 items-center pl-4 pr-3 py-2.5 text-left transition-colors',
                    active ? 'bg-bg-card shadow-[inset_2px_0_0_#10B981]' : 'hover:bg-bg-card/60',
                  )}
                >
                  <span className={clsx('text-xs font-semibold truncate', active ? 'text-ink-primary' : 'text-ink-primary/80')}>{s}</span>
                  <span className="text-[11px] text-ink-primary/80 tabular-nums text-right">{fmt(q?.price, s)}</span>
                  <span className={clsx('text-[10px] tabular-nums', pct == null ? 'text-ink-muted' : pUp ? 'text-atlas' : 'text-bear')}>{fmtPct(pct)}</span>
                  <span className="relative h-[3px] w-12 justify-self-end bg-bg-border rounded-full" aria-hidden>
                    {pct != null && (
                      <span
                        className={clsx('absolute top-0 h-full rounded-full', pUp ? 'left-1/2 bg-atlas' : 'right-1/2 bg-bear')}
                        style={{ width: `${(Math.abs(pct) / maxAbsPct) * 50}%` }}
                      />
                    )}
                  </span>
                </button>
              )
            })}
          </div>
        </nav>

        {/* Chart */}
        <section className="flex flex-col min-w-0 min-h-0">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-bg-border">
            <div className="flex flex-wrap items-baseline gap-x-3.5 gap-y-1">
              <select
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                className="lg:hidden bg-bg-card border border-bg-border rounded-md px-2 py-1 text-sm text-ink-primary"
                aria-label="Activo"
              >
                {SYMBOLS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <h1 className="hidden lg:block text-xl font-bold text-ink-primary">{symbol}</h1>
              <span className="font-sans text-xs text-ink-secondary">{DISPLAY_NAME[symbol] ?? symbol}</span>
              <span
                className={clsx(
                  'text-xl tabular-nums transition-colors duration-300',
                  flash === 'up' ? 'text-atlas' : flash === 'down' ? 'text-bear' : 'text-ink-primary',
                )}
              >
                {fmt(quote?.price, symbol)}
              </span>
              <span className={clsx('text-[13px] tabular-nums', up ? 'text-atlas' : 'text-bear')}>{fmtPct(quote?.changePct)}</span>
              {quote && !quoteError && (
                <span className="flex items-center gap-1.5 text-[10px] text-atlas">
                  <span className="w-1.5 h-1.5 rounded-full bg-atlas animate-pulse" />
                  LIVE
                </span>
              )}
            </div>
            <div className="flex gap-0.5 text-[11px]" role="group" aria-label="Temporalidad">
              {TIMEFRAMES.map((tf) => (
                <button
                  key={tf.value}
                  type="button"
                  onClick={() => setInterval_(tf.value)}
                  aria-pressed={interval === tf.value}
                  className={clsx(
                    'px-2.5 py-1.5 rounded-md transition-colors',
                    interval === tf.value ? 'bg-atlas/15 text-atlas' : 'text-ink-secondary hover:text-ink-primary',
                  )}
                >
                  {tf.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 min-h-0">
            <TradingViewChart symbol={symbol} interval={interval} />
          </div>
        </section>

        {/* Context */}
        <aside className="hidden xl:flex flex-col min-h-0 border-l border-bg-border overflow-y-auto">
          <div className="px-[18px] py-4 border-b border-bg-border">
            <p className="text-[10px] tracking-[0.14em] text-ink-secondary pb-1.5">SESIÓN</p>
            {[
              ['Apertura', fmt(quote?.open, symbol), 'text-ink-primary'],
              ['Máximo', fmt(quote?.high, symbol), 'text-atlas'],
              ['Mínimo', fmt(quote?.low, symbol), 'text-bear'],
              ['Cierre ant.', fmt(quote?.prevClose, symbol), 'text-ink-primary'],
              ['Cambio', fmtPct(quote?.changePct), up ? 'text-atlas' : 'text-bear'],
            ].map(([k, v, c]) => (
              <div key={k} className="flex justify-between py-[5px] text-xs">
                <span className="font-sans text-ink-secondary">{k}</span>
                <span className={clsx('tabular-nums', c)}>{v}</span>
              </div>
            ))}
            <div className="pt-2 space-y-1">
              <div className="relative h-1 rounded-full bg-bg-border">
                {rangePct != null && <div className="absolute -top-[3px] w-0.5 h-2.5 bg-ink-primary -translate-x-1/2" style={{ left: `${rangePct}%` }} />}
              </div>
              <p className="text-[9px] text-ink-muted">RANGO DEL DÍA</p>
            </div>
            {quoteLoading && !quote && <p className="pt-2 text-[10px] text-ink-muted">Cargando cotización…</p>}
            {quoteError && <p className="pt-2 text-[10px] text-bear">Error de feed: {quoteError}</p>}
          </div>

          <div className="px-[18px] py-4 border-b border-bg-border space-y-2">
            <div className="flex justify-between items-baseline">
              <p className="text-[10px] tracking-[0.14em] text-ink-secondary">SCANNER</p>
              <Link href="/dashboard/scanner" className="font-sans text-[11px] text-atlas hover:text-atlas/80">Ver →</Link>
            </div>
            {asset ? (
              <>
                <div className="flex items-baseline gap-2.5">
                  <span className={clsx('text-[30px] leading-none tabular-nums', scoreText(asset.totalScore))}>{asset.totalScore}</span>
                  <span className="font-sans text-xs text-ink-secondary">
                    {RATING_LABEL[asset.rating] ?? asset.rating} · {BIAS_LABEL[asset.bias] ?? asset.bias}
                  </span>
                </div>
                <div className="flex h-1.5 gap-0.5 rounded-sm overflow-hidden bg-bg-elevated" title={`Macro ${asset.macroScore} · Técnico ${asset.technicalScore} · Timing ${asset.timingScore}`}>
                  <div className="bg-oracle" style={{ width: `${(asset.macroScore / sum) * asset.totalScore}%` }} />
                  <div className="bg-atlas" style={{ width: `${(asset.technicalScore / sum) * asset.totalScore}%` }} />
                  <div className="bg-pulse" style={{ width: `${(asset.timingScore / sum) * asset.totalScore}%` }} />
                </div>
              </>
            ) : (
              <p className="font-sans text-xs text-ink-muted">Este activo no está en el radar.</p>
            )}
          </div>

          <div className="px-[18px] py-4 border-b border-bg-border space-y-2">
            <p className="text-[10px] tracking-[0.14em] text-ink-secondary">ZONAS JARVIS</p>
            {zones.length === 0 && <p className="font-sans text-xs text-ink-muted">Sin zonas activas para {symbol}.</p>}
            {zones.map((z, i) => (
              <div key={i} className="flex justify-between text-xs">
                <span className={z.critical ? 'text-bear' : 'text-oracle'}>{z.label}</span>
                <span className="tabular-nums text-ink-primary">{z.top}</span>
              </div>
            ))}
          </div>

          <div className="flex-1 min-h-[360px]">
            <MarketNewsPanel filterSymbols={[symbol]} />
          </div>
        </aside>
      </div>
    </div>
  )
}
