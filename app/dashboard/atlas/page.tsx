'use client'
// Chart height = full viewport minus: topbar(48px) + padding(40px) + toolbar(44px) + headerRow(~80px) + symbolBar(~44px) + spacing(24px)
const CHART_HEIGHT = 'calc(100vh - 280px)'

import dynamic from 'next/dynamic'
import { SectionTitle } from '@/components/ui/SectionTitle'
import { useState, useEffect } from 'react'
import { useTVQuote } from '@/hooks/useTVQuote'
import { MarketNewsPanel } from '@/components/pulse/MarketNewsPanel'
import type { OracleAlert } from '@/lib/oracle/types'

// Dynamically import to prevent SSR issues with TradingView scripts
const TradingViewChart = dynamic(
  () => import('@/components/atlas/TradingViewChart').then(m => m.TradingViewChart),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-[#0D1017]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-atlas border-t-transparent rounded-full animate-spin" />
          <span className="text-[10px] font-mono text-atlas uppercase tracking-[0.2em]">Conectando con TradingView...</span>
        </div>
      </div>
    )
  }
)

const SYMBOLS = ['XAUUSD', 'EURUSD', 'GBPUSD', 'BTCUSD', 'USDJPY', 'GBPJPY']

const TIMEFRAMES: { label: string; value: string }[] = [
  { label: 'M1',  value: '1'   },
  { label: 'M5',  value: '5'   },
  { label: 'M15', value: '15'  },
  { label: 'M30', value: '30'  },
  { label: 'H1',  value: '60'  },
  { label: 'H4',  value: '240' },
  { label: 'D1',  value: 'D'   },
  { label: 'W1',  value: 'W'   },
]

const TV_DISPLAY_MAP: Record<string, string> = {
  XAUUSD: 'XAU/USD',
  EURUSD: 'EUR/USD',
  GBPUSD: 'GBP/USD',
  BTCUSD: 'BTC/USDT',
  USDJPY: 'USD/JPY',
  GBPJPY: 'GBP/JPY',
}

function formatPrice(price: number | null, symbol: string): string {
  if (price === null) return '—'
  const decimals = symbol.includes('JPY') ? 3 : symbol === 'XAUUSD' ? 2 : 5
  return price.toFixed(decimals)
}

export default function AtlasPage() {
  const [selectedSymbol, setSelectedSymbol] = useState('XAUUSD')
  const [selectedInterval, setSelectedInterval] = useState('60')
  const [prevPrice, setPrevPrice] = useState<number | null>(null)
  const [priceDir, setPriceDir] = useState<'up' | 'down' | 'neutral'>('neutral')
  const [alerts, setAlerts] = useState<OracleAlert[]>([])

  // Fetch live quotes from market quote API (Yahoo Finance feed)
  const { quotes, loading: quoteLoading, error: quoteError } = useTVQuote(SYMBOLS, 3000)

  const quote = quotes[selectedSymbol] ?? null

  // Detect price direction for color flash
  useEffect(() => {
    if (!quote?.price) return
    if (prevPrice !== null && quote.price !== prevPrice) {
      setPriceDir(quote.price > prevPrice ? 'up' : 'down')
      const t = setTimeout(() => setPriceDir('neutral'), 600)
      return () => clearTimeout(t)
    }
    setPrevPrice(quote.price)
  }, [quote?.price])

  useEffect(() => {
    if (quote?.price) setPrevPrice(quote.price)
  }, [selectedSymbol])

  useEffect(() => {
    let mounted = true
    const fetchAlerts = async () => {
      try {
        const res = await fetch('/api/oracle/alerts')
        const payload = await res.json()
        if (!mounted) return
        setAlerts(payload?.data ?? [])
      } catch {
        if (!mounted) return
        setAlerts([])
      }
    }

    fetchAlerts()
    const timer = setInterval(fetchAlerts, 60_000)
    return () => {
      mounted = false
      clearInterval(timer)
    }
  }, [])

  const alertZones = alerts
    .filter(a => a.symbol === selectedSymbol && a.priceZone)
    .map(a => ({
      ...a.priceZone!,
      color: a.severity === 'critical' ? '#ef4444' : '#25f2fd'
    }))

  const priceColor = priceDir === 'up' ? 'text-green-400' : priceDir === 'down' ? 'text-red-400' : 'text-ink-primary'
  const changeColor = (quote?.changePct ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'

  return (
    <div className="space-y-4 animate-fade-in">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-bg-border pb-4">
        <div>
          <h1 className="text-base font-mono font-bold text-ink-primary tracking-tight uppercase">ATLAS · Market Structure</h1>
          <p className="text-[10px] font-mono text-ink-muted mt-0.5 tracking-wider uppercase">
            Live Feed · Institutional Price Action &amp; Volume Analysis
          </p>
        </div>

        {/* Live Price Badge */}
        {quote?.price && (
          <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-bg-card border border-bg-border glass-card">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-[9px] font-mono text-ink-dim uppercase">Live</span>
            <span className={`text-sm font-mono font-bold tabular-nums transition-colors duration-300 ${priceColor}`}>
              {formatPrice(quote.price, selectedSymbol)}
            </span>
            {quote.changePct !== null && (
              <span className={`text-[10px] font-mono font-semibold tabular-nums ${changeColor}`}>
                {quote.changePct >= 0 ? '+' : ''}{quote.changePct.toFixed(2)}%
              </span>
            )}
          </div>
        )}
      </div>

      {/* Symbol Selector */}
      <div className="flex flex-wrap items-center gap-1.5">
        {SYMBOLS.map(s => {
          const q = quotes[s]
          const pct = q?.changePct ?? null
          return (
            <button
              key={s}
              onClick={() => setSelectedSymbol(s)}
              className={`px-3 py-1.5 rounded-lg font-mono text-[9px] uppercase tracking-widest border transition-all flex flex-col items-center ${
                selectedSymbol === s
                  ? 'bg-atlas border-atlas text-bg-base shadow-[0_0_12px_rgba(37,242,253,0.3)]'
                  : 'bg-bg-deep border-bg-border text-ink-muted hover:border-atlas/50 hover:text-atlas'
              }`}
            >
              <span>{s}</span>
              {pct !== null && (
                <span className={`text-[8px] tabular-nums font-normal ${
                  selectedSymbol === s ? 'text-bg-base/80' : pct >= 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                  {pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Main Chart Container */}
      <div className="bg-bg-card border border-bg-border rounded-2xl overflow-hidden glass-card flex flex-col" style={{ height: `calc(${CHART_HEIGHT} + 44px)` }}>

        {/* Chart Toolbar */}
        <div className="px-5 py-3 border-b border-bg-border flex items-center justify-between flex-wrap gap-3 shrink-0">
          <div className="flex items-center gap-4">
            <span className="text-xs font-mono font-bold text-ink-primary uppercase">
              {TV_DISPLAY_MAP[selectedSymbol] ?? selectedSymbol}
            </span>
            {/* Inline live price */}
            {quote?.price && (
              <span className={`text-sm font-mono font-bold tabular-nums transition-colors duration-300 ${priceColor}`}>
                {formatPrice(quote.price, selectedSymbol)}
              </span>
            )}
            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-green-500/10 border border-green-500/20">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-[9px] font-mono text-green-400 uppercase tracking-wider">Live feed</span>
            </div>
          </div>

          {/* Timeframe Selector */}
          <div className="flex items-center gap-1">
            {TIMEFRAMES.map(tf => (
              <button
                key={tf.value}
                onClick={() => setSelectedInterval(tf.value)}
                className={`px-2.5 py-1 rounded text-[9px] font-mono uppercase tracking-wider transition-all border ${
                  selectedInterval === tf.value
                    ? 'bg-atlas/20 border-atlas/40 text-atlas'
                    : 'bg-transparent border-transparent text-ink-dim hover:text-ink-muted hover:border-bg-border'
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>

        {/* TradingView Chart */}
        <div className="flex-1 min-h-0">
          <TradingViewChart
            symbol={selectedSymbol}
            interval={selectedInterval}
          />
        </div>
      </div>

      {/* Bottom Info Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pb-10">

        {/* OHLC live */}
        <div className="bg-bg-card border border-bg-border rounded-xl p-5 space-y-4">
          <SectionTitle label={`Cotización Live · ${TV_DISPLAY_MAP[selectedSymbol] ?? selectedSymbol}`} accent="atlas" />
          <div className="space-y-1">
            <PriceRow label="Precio"    value={formatPrice(quote?.price    ?? null, selectedSymbol)} color={priceColor} large />
            <PriceRow label="Apertura"  value={formatPrice(quote?.open     ?? null, selectedSymbol)} />
            <PriceRow label="Máximo"    value={formatPrice(quote?.high     ?? null, selectedSymbol)} color="text-green-400" />
            <PriceRow label="Mínimo"    value={formatPrice(quote?.low     ?? null, selectedSymbol)}  color="text-red-400" />
            <PriceRow label="Cierre ant." value={formatPrice(quote?.prevClose ?? null, selectedSymbol)} />
            <PriceRow
              label="Cambio"
              value={quote?.changePct !== null && quote?.changePct !== undefined
                ? `${quote.changePct >= 0 ? '+' : ''}${quote.changePct.toFixed(2)}%`
                : '—'}
              color={changeColor}
            />
            <div className="pt-2 flex items-center gap-1.5">
              {quoteLoading && !quote && <div className="w-2 h-2 border border-atlas border-t-transparent rounded-full animate-spin" />}
              {quoteError && <span className="text-[9px] font-mono text-bear uppercase">Error: {quoteError}</span>}
              {quote && !quoteError && (
                <>
                  <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-[9px] font-mono text-green-400 uppercase">Fuente: Yahoo Finance · 3s poll</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Zonas Activas */}
        <div className="bg-bg-card border border-bg-border rounded-xl p-5 space-y-4">
          <SectionTitle label="Zonas Activas (JARVIS)" accent="oracle" />
          <div className="space-y-3">
            {alertZones.length > 0 ? alertZones.map((z, i) => (
              <div key={i} className="flex justify-between items-center bg-oracle/5 border border-oracle/20 p-2 rounded">
                <span className="text-[10px] font-mono text-oracle uppercase font-bold">{z.label}</span>
                <span className="text-[10px] font-mono text-ink-primary">@{z.top}</span>
              </div>
            )) : (
              <p className="text-[10px] font-mono text-ink-dim uppercase italic text-center py-2">Buscando setups zonales...</p>
            )}
          </div>
        </div>

        {/* Todos los símbolos en mini-tabla */}
        <div className="bg-bg-card border border-bg-border rounded-xl p-5 space-y-3">
          <SectionTitle label="Radar Multi-Par · Live" accent="oracle" />
          <div className="space-y-1">
            {SYMBOLS.map(s => {
              const q = quotes[s]
              const pct = q?.changePct ?? null
              const isActive = s === selectedSymbol
              return (
                <button
                  key={s}
                  onClick={() => setSelectedSymbol(s)}
                  className={`w-full flex items-center justify-between py-1.5 px-2 rounded transition-all ${
                    isActive ? 'bg-atlas/10 border border-atlas/20' : 'hover:bg-bg-elevated border border-transparent'
                  }`}
                >
                  <span className={`text-[10px] font-mono font-bold uppercase ${isActive ? 'text-atlas' : 'text-ink-secondary'}`}>{s}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-mono text-ink-primary tabular-nums">
                      {formatPrice(q?.price ?? null, s)}
                    </span>
                    {pct !== null && (
                      <span className={`text-[9px] font-mono tabular-nums w-14 text-right ${pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

      </div>

      {/* News Panel */}
      <div style={{ height: '520px' }}>
        <MarketNewsPanel filterSymbols={[selectedSymbol]} />
      </div>

    </div>
  )
}

function StatusItem({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-bg-border last:border-0">
      <span className="text-[10px] font-mono text-ink-dim uppercase">{label}</span>
      <span className={`text-[11px] font-mono font-bold ${color}`}>{value}</span>
    </div>
  )
}

function PriceRow({ label, value, color = 'text-ink-secondary', large = false }: {
  label: string; value: string; color?: string; large?: boolean
}) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-bg-border/50 last:border-0">
      <span className="text-[9px] font-mono text-ink-dim uppercase tracking-wider">{label}</span>
      <span className={`font-mono font-bold tabular-nums ${large ? 'text-sm' : 'text-[11px]'} ${color}`}>{value}</span>
    </div>
  )
}
