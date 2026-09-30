'use client'

import { useEffect, useRef, useState } from 'react'
import { clsx } from 'clsx'

interface OrderBookLevel {
  price: number
  qty: number
}

export interface OrderBookSnapshot {
  bestBid: number | null
  bestAsk: number | null
  spread: number | null
  bidDepth: number | null
  askDepth: number | null
}

interface OrderBookHeatmapProps {
  /** Binance symbol, lowercase (e.g. 'btcusdt'). */
  symbol: string
  /** How many levels to show per side. */
  levels?: number
  /** Called at most once every few seconds with the current book summary. */
  onSnapshot?: (snapshot: OrderBookSnapshot) => void
}

const SNAPSHOT_THROTTLE_MS = 5000

function parseLevels(raw: unknown): OrderBookLevel[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((row) => {
      if (!Array.isArray(row) || row.length < 2) return null
      const price = Number.parseFloat(row[0])
      const qty = Number.parseFloat(row[1])
      if (!Number.isFinite(price) || !Number.isFinite(qty)) return null
      return { price, qty }
    })
    .filter((level): level is OrderBookLevel => Boolean(level))
}

export function OrderBookHeatmap({ symbol, levels = 10, onSnapshot }: OrderBookHeatmapProps) {
  const [bids, setBids] = useState<OrderBookLevel[]>([])
  const [asks, setAsks] = useState<OrderBookLevel[]>([])
  const [status, setStatus] = useState<'connecting' | 'live' | 'error'>('connecting')
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSnapshotAt = useRef(0)
  const onSnapshotRef = useRef(onSnapshot)
  onSnapshotRef.current = onSnapshot

  useEffect(() => {
    let cancelled = false
    setBids([])
    setAsks([])

    function connect() {
      setStatus('connecting')
      const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${symbol}@depth20@100ms`)
      wsRef.current = ws

      ws.onopen = () => {
        if (!cancelled) setStatus('live')
      }

      ws.onmessage = (event) => {
        if (cancelled) return
        try {
          const payload = JSON.parse(event.data)
          const parsedBids = parseLevels(payload?.bids)
          const parsedAsks = parseLevels(payload?.asks)
          setBids(parsedBids)
          setAsks(parsedAsks)

          const now = Date.now()
          if (onSnapshotRef.current && now - lastSnapshotAt.current >= SNAPSHOT_THROTTLE_MS) {
            lastSnapshotAt.current = now
            const topBids = [...parsedBids].sort((a, b) => b.price - a.price).slice(0, levels)
            const topAsks = [...parsedAsks].sort((a, b) => a.price - b.price).slice(0, levels)
            const bestBid = topBids[0]?.price ?? null
            const bestAsk = topAsks[0]?.price ?? null
            onSnapshotRef.current({
              bestBid,
              bestAsk,
              spread: bestBid !== null && bestAsk !== null ? bestAsk - bestBid : null,
              bidDepth: topBids.length > 0 ? topBids.reduce((sum, l) => sum + l.qty, 0) : null,
              askDepth: topAsks.length > 0 ? topAsks.reduce((sum, l) => sum + l.qty, 0) : null,
            })
          }
        } catch {
          // Ignore a single malformed frame — the next tick corrects it.
        }
      }

      ws.onerror = () => {
        if (!cancelled) setStatus('error')
      }

      ws.onclose = () => {
        if (cancelled) return
        setStatus('error')
        reconnectTimer.current = setTimeout(connect, 3000)
      }
    }

    connect()

    return () => {
      cancelled = true
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
      wsRef.current?.close()
    }
  }, [symbol])

  const visibleAsks = [...asks].sort((a, b) => a.price - b.price).slice(0, levels)
  const visibleBids = [...bids].sort((a, b) => b.price - a.price).slice(0, levels)

  const maxQty = Math.max(1, ...visibleAsks.map((l) => l.qty), ...visibleBids.map((l) => l.qty))
  const bestAsk = visibleAsks[0]?.price ?? null
  const bestBid = visibleBids[0]?.price ?? null
  const spread = bestAsk !== null && bestBid !== null ? bestAsk - bestBid : null

  const decimals = 2

  return (
    <div className="rounded-xl border border-bg-border bg-bg-base overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-bg-border">
        <span className="text-xs font-mono uppercase tracking-[0.12em] text-ink-secondary">
          {symbol.replace('usdt', '/USDT').toUpperCase()}
        </span>
        <span
          className={clsx(
            'flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider',
            status === 'live' ? 'text-atlas' : status === 'error' ? 'text-bear' : 'text-ink-dim',
          )}
        >
          <span
            className={clsx(
              'w-1.5 h-1.5 rounded-full',
              status === 'live' ? 'bg-atlas animate-pulse' : status === 'error' ? 'bg-bear' : 'bg-ink-dim',
            )}
          />
          {status === 'live' ? 'En vivo' : status === 'error' ? 'Reconectando…' : 'Conectando…'}
        </span>
      </div>

      <div className="px-4 py-3 space-y-0.5">
        {/* Asks: lowest (best) ask closest to the spread, highest at the top */}
        {[...visibleAsks].reverse().map((level) => (
          <OrderBookRow key={`ask-${level.price}`} level={level} maxQty={maxQty} decimals={decimals} side="ask" />
        ))}

        {/* Spread marker */}
        <div className="flex items-center justify-between px-2 py-1.5 my-1.5 rounded bg-oracle/10 border border-oracle/30">
          <span className="text-[10px] font-mono uppercase tracking-wider text-oracle">Spread</span>
          <span className="text-xs font-mono tabular-nums text-oracle">
            {spread !== null ? spread.toFixed(decimals) : 'sin dato'}
          </span>
        </div>

        {/* Bids: best bid closest to the spread */}
        {visibleBids.map((level) => (
          <OrderBookRow key={`bid-${level.price}`} level={level} maxQty={maxQty} decimals={decimals} side="bid" />
        ))}

        {visibleAsks.length === 0 && visibleBids.length === 0 && (
          <p className="px-2 py-6 text-center text-xs font-sans text-ink-dim">
            {status === 'error' ? 'Sin conexión al libro de órdenes. Reintentando…' : 'Cargando libro de órdenes…'}
          </p>
        )}
      </div>
    </div>
  )
}

function OrderBookRow({
  level,
  maxQty,
  decimals,
  side,
}: {
  level: OrderBookLevel
  maxQty: number
  decimals: number
  side: 'bid' | 'ask'
}) {
  const widthPct = Math.max(2, Math.min(100, (level.qty / maxQty) * 100))
  const isBid = side === 'bid'

  return (
    <div className="grid grid-cols-[76px_1fr_80px] items-center gap-2 h-6 text-[11px] font-mono tabular-nums">
      <span className={isBid ? 'text-atlas' : 'text-bear'}>{level.price.toFixed(decimals)}</span>
      <div className="relative h-3.5 bg-bg-elevated/60 rounded-sm overflow-hidden">
        <div
          className={clsx('absolute inset-y-0 left-0 rounded-sm', isBid ? 'bg-atlas/60' : 'bg-bear/60')}
          style={{ width: `${widthPct}%` }}
        />
      </div>
      <span className="text-right text-ink-secondary">{level.qty.toFixed(4)}</span>
    </div>
  )
}
