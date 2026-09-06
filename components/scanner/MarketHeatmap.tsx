'use client'

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import { SECTOR_ETFS } from '@/lib/market-data'

interface QuoteItem {
  symbol: string
  changePct: number | null
}

interface QuoteResponse {
  quotes: QuoteItem[]
}

interface Tile {
  symbol: string
  label: string
  changePct: number | null
}

const INDICES: Tile[] = [
  { symbol: 'SPX500', label: 'S&P 500', changePct: null },
  { symbol: 'NAS100', label: 'Nasdaq 100', changePct: null },
  { symbol: 'US30', label: 'Dow Jones', changePct: null },
]

const MEGA_CAP_TECH = ['NVDA', 'MSFT', 'GOOGL', 'AMZN', 'META', 'AVGO', 'TSM', 'AMD', 'MU', 'TSLA', 'PLTR']

const SECTOR_TILES: Tile[] = Object.entries(SECTOR_ETFS).map(([sector, symbol]) => ({
  symbol,
  label: sector,
  changePct: null,
}))

const CRYPTO_COMMODITIES: Tile[] = [
  { symbol: 'BTCUSD', label: 'Bitcoin', changePct: null },
  { symbol: 'ETHUSD', label: 'Ethereum', changePct: null },
  { symbol: 'XAUUSD', label: 'Oro', changePct: null },
]

const ALL_SYMBOLS = [
  ...INDICES.map((t) => t.symbol),
  ...MEGA_CAP_TECH,
  ...SECTOR_TILES.map((t) => t.symbol),
  ...CRYPTO_COMMODITIES.map((t) => t.symbol),
]

function heatStyle(changePct: number | null): CSSProperties {
  if (changePct === null) return { backgroundColor: 'rgba(148, 163, 184, 0.08)' }
  const intensity = Math.min(Math.abs(changePct) / 3, 1)
  const alpha = 0.1 + intensity * 0.55
  const rgb = changePct >= 0 ? '0, 201, 167' : '239, 68, 68'
  return { backgroundColor: `rgba(${rgb}, ${alpha})` }
}

function Tile({ symbol, label, changePct }: Tile) {
  return (
    <Link
      href={`/dashboard/stock/${symbol}`}
      style={heatStyle(changePct)}
      className="rounded-lg border border-bg-border px-3 py-2.5 flex flex-col items-center justify-center text-center hover:border-ink-dim transition-colors"
    >
      <span className="text-xs font-mono font-bold text-ink-primary">{symbol}</span>
      <span className="text-[9px] font-mono text-ink-dim truncate max-w-full">{label}</span>
      <span className="text-[10px] font-mono font-bold text-ink-primary mt-1">
        {changePct !== null ? `${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%` : '—'}
      </span>
    </Link>
  )
}

function Group({ title, tiles }: { title: string; tiles: Tile[] }) {
  return (
    <div className="space-y-2">
      <p className="text-[9px] font-mono text-ink-dim uppercase tracking-widest">{title}</p>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
        {tiles.map((tile) => (
          <Tile key={tile.symbol} {...tile} />
        ))}
      </div>
    </div>
  )
}

export function MarketHeatmap() {
  const [quotes, setQuotes] = useState<Record<string, number | null>>({})
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        const payload = await fetch(`/api/market/quote?symbols=${ALL_SYMBOLS.join(',')}`).then((r) => r.json() as Promise<QuoteResponse>)
        if (!mounted) return
        const map: Record<string, number | null> = {}
        for (const q of payload?.quotes ?? []) map[q.symbol] = q.changePct
        setQuotes(map)
        setLastUpdated(new Date().toISOString())
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

  const withQuotes = (tiles: Tile[]) => tiles.map((t) => ({ ...t, changePct: quotes[t.symbol] ?? null }))

  const indices = useMemo(() => withQuotes(INDICES), [quotes])
  const megaCap = useMemo(() => withQuotes(MEGA_CAP_TECH.map((s) => ({ symbol: s, label: s, changePct: null }))), [quotes])
  const sectors = useMemo(() => withQuotes(SECTOR_TILES), [quotes])
  const crypto = useMemo(() => withQuotes(CRYPTO_COMMODITIES), [quotes])

  return (
    <div className="rounded-xl border border-bg-border bg-bg-card p-5 space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-mono font-bold text-ink-primary uppercase tracking-wider">Mapa de calor · Mercado americano</p>
        <span className="text-[9px] font-mono text-ink-dim">
          {lastUpdated ? `Actualizado ${new Date(lastUpdated).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}` : 'Cargando...'}
        </span>
      </div>
      <Group title="Índices" tiles={indices} />
      <Group title="Mega-Cap Tech" tiles={megaCap} />
      <Group title="Sectores (SPDR ETFs)" tiles={sectors} />
      <Group title="Cripto & Commodities" tiles={crypto} />
    </div>
  )
}
