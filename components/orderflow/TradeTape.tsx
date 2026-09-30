'use client'

import { useEffect, useRef, useState } from 'react'
import { clsx } from 'clsx'

interface Trade {
  id: number
  time: number
  price: number
  qty: number
  side: 'buy' | 'sell'
}

interface CvdPoint {
  time: number
  value: number
}

const MAX_TAPE_ROWS = 40
const MAX_CVD_POINTS = 240
const SNAPSHOT_THROTTLE_MS = 5000

export interface TradeTapeSnapshot {
  cvd: number
  lastPrice: number | null
}

interface TradeTapeProps {
  /** Binance symbol, lowercase (e.g. 'btcusdt'). */
  symbol: string
  /** Called at most once every few seconds with the current CVD/price. */
  onSnapshot?: (snapshot: TradeTapeSnapshot) => void
}

export function TradeTape({ symbol, onSnapshot }: TradeTapeProps) {
  const [trades, setTrades] = useState<Trade[]>([])
  const [cvdSeries, setCvdSeries] = useState<CvdPoint[]>([])
  const [status, setStatus] = useState<'connecting' | 'live' | 'error'>('connecting')
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cvdRef = useRef(0)
  const lastSnapshotAt = useRef(0)
  const onSnapshotRef = useRef(onSnapshot)
  onSnapshotRef.current = onSnapshot

  useEffect(() => {
    let cancelled = false
    setTrades([])
    setCvdSeries([])
    cvdRef.current = 0

    function connect() {
      setStatus('connecting')
      const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${symbol}@aggTrade`)
      wsRef.current = ws

      ws.onopen = () => {
        if (!cancelled) setStatus('live')
      }

      ws.onmessage = (event) => {
        if (cancelled) return
        try {
          const payload = JSON.parse(event.data)
          const price = Number.parseFloat(payload?.p)
          const qty = Number.parseFloat(payload?.q)
          const time = Number(payload?.T) || Date.now()
          // Binance's `m` flag means "buyer is the maker" — i.e. a resting
          // buy order got filled by an incoming market sell, so the trade
          // was seller-initiated. false means the taker bought.
          const sellerInitiated = Boolean(payload?.m)
          if (!Number.isFinite(price) || !Number.isFinite(qty)) return

          const side: Trade['side'] = sellerInitiated ? 'sell' : 'buy'
          const signedQty = side === 'buy' ? qty : -qty
          cvdRef.current += signedQty
          const cvdNow = cvdRef.current

          const id = Number(payload?.a) || time
          setTrades((prev) => [{ id, time, price, qty, side }, ...prev].slice(0, MAX_TAPE_ROWS))
          setCvdSeries((prev) => [...prev, { time, value: cvdNow }].slice(-MAX_CVD_POINTS))

          const now = Date.now()
          if (onSnapshotRef.current && now - lastSnapshotAt.current >= SNAPSHOT_THROTTLE_MS) {
            lastSnapshotAt.current = now
            onSnapshotRef.current({ cvd: cvdNow, lastPrice: price })
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

  const currentCvd = cvdSeries[cvdSeries.length - 1]?.value ?? 0

  return (
    <div className="rounded-xl border border-bg-border bg-bg-base overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-bg-border">
        <span className="text-xs font-mono uppercase tracking-[0.12em] text-ink-secondary">
          Cinta · {symbol.replace('usdt', '/USDT').toUpperCase()}
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

      {/* Cumulative Volume Delta */}
      <div className="px-5 py-3 border-b border-bg-border">
        <div className="flex items-baseline justify-between mb-1.5">
          <span className="text-[10px] font-mono uppercase tracking-wider text-ink-secondary">CVD (esta sesión)</span>
          <span className={clsx('text-sm font-mono tabular-nums', currentCvd >= 0 ? 'text-atlas' : 'text-bear')}>
            {currentCvd >= 0 ? '+' : ''}
            {currentCvd.toFixed(3)}
          </span>
        </div>
        <CvdSparkline series={cvdSeries} />
      </div>

      {/* Tape */}
      <div className="max-h-[360px] overflow-y-auto">
        {trades.length === 0 && (
          <p className="px-5 py-6 text-center text-xs font-sans text-ink-dim">
            {status === 'error' ? 'Sin conexión a la cinta. Reintentando…' : 'Esperando operaciones…'}
          </p>
        )}
        {trades.map((trade) => (
          <div
            key={trade.id}
            className="grid grid-cols-[64px_1fr_80px] items-center gap-2 px-5 h-6 text-[11px] font-mono tabular-nums"
          >
            <span className="text-ink-dim">
              {new Date(trade.time).toLocaleTimeString('es-ES', { hour12: false, timeZone: 'UTC' })}
            </span>
            <span className={trade.side === 'buy' ? 'text-atlas' : 'text-bear'}>{trade.price.toFixed(2)}</span>
            <span className="text-right text-ink-secondary">{trade.qty.toFixed(4)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function CvdSparkline({ series }: { series: CvdPoint[] }) {
  const width = 100
  const height = 32

  if (series.length < 2) {
    return <div className="h-8" />
  }

  const values = series.map((p) => p.value)
  const min = Math.min(0, ...values)
  const max = Math.max(0, ...values)
  const range = max - min || 1

  const points = series
    .map((p, i) => {
      const x = (i / (series.length - 1)) * width
      const y = height - ((p.value - min) / range) * height
      return `${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(' ')

  const zeroY = height - ((0 - min) / range) * height
  const last = values[values.length - 1] ?? 0

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-8" preserveAspectRatio="none">
      <line
        x1="0"
        y1={zeroY}
        x2={width}
        y2={zeroY}
        stroke="currentColor"
        strokeWidth="0.5"
        className="text-ink-dim"
        strokeDasharray="2,2"
      />
      <polyline points={points} fill="none" strokeWidth="1.5" className={last >= 0 ? 'stroke-atlas' : 'stroke-bear'} />
    </svg>
  )
}
