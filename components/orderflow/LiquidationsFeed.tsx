'use client'

import { useEffect, useRef, useState } from 'react'
import { clsx } from 'clsx'

interface LiquidationEvent {
  id: string
  time: number
  symbol: string
  /** Side of the position that got force-closed. */
  side: 'long' | 'short'
  price: number
  qty: number
  notional: number
}

const MAX_ROWS = 30
// The combined stream broadcasts every USDT-M futures symbol — filter down
// to what the rest of this page covers (BTC/ETH) instead of the full firehose.
const TRACKED_SYMBOLS = new Set(['BTCUSDT', 'ETHUSDT'])
// Binance's futures liquidation engine fires many tiny partial fills —
// only surface liquidations large enough to matter for reading market stress.
const MIN_NOTIONAL_USD = 1000

function formatNotional(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`
  return `$${value.toFixed(0)}`
}

export function LiquidationsFeed() {
  const [events, setEvents] = useState<LiquidationEvent[]>([])
  const [status, setStatus] = useState<'connecting' | 'live' | 'error'>('connecting')
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let cancelled = false

    function connect() {
      setStatus('connecting')
      const ws = new WebSocket('wss://fstream.binance.com/ws/!forceOrder@arr')
      wsRef.current = ws

      ws.onopen = () => {
        if (!cancelled) setStatus('live')
      }

      ws.onmessage = (event) => {
        if (cancelled) return
        try {
          const payload = JSON.parse(event.data)
          const order = payload?.o
          const symbol = String(order?.s ?? '')
          if (!TRACKED_SYMBOLS.has(symbol)) return

          const price = Number.parseFloat(order?.ap ?? order?.p)
          const qty = Number.parseFloat(order?.z ?? order?.q)
          const time = Number(order?.T) || Date.now()
          if (!Number.isFinite(price) || !Number.isFinite(qty)) return

          const notional = price * qty
          if (notional < MIN_NOTIONAL_USD) return

          // A SELL liquidation order force-closes a long (forced selling);
          // a BUY liquidation order force-closes a short (forced buying).
          const side: LiquidationEvent['side'] = order?.S === 'SELL' ? 'long' : 'short'
          const id = `${symbol}-${time}-${price}-${qty}`

          setEvents((prev) => [{ id, time, symbol, side, price, qty, notional }, ...prev].slice(0, MAX_ROWS))
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
  }, [])

  return (
    <div className="rounded-xl border border-bg-border bg-bg-base overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-bg-border">
        <span className="text-xs font-mono uppercase tracking-[0.12em] text-ink-secondary">
          Liquidaciones · Futuros BTC/ETH
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

      <div className="max-h-[240px] overflow-y-auto">
        {events.length === 0 && (
          <p className="px-5 py-6 text-center text-xs font-sans text-ink-dim">
            {status === 'error'
              ? 'Sin conexión al feed de liquidaciones. Reintentando…'
              : 'Esperando liquidaciones mayores a $1,000…'}
          </p>
        )}
        {events.map((ev) => (
          <div
            key={ev.id}
            className="grid grid-cols-[64px_56px_70px_1fr_90px] items-center gap-2 px-5 h-6 text-[11px] font-mono tabular-nums"
          >
            <span className="text-ink-dim">
              {new Date(ev.time).toLocaleTimeString('es-ES', { hour12: false, timeZone: 'UTC' })}
            </span>
            <span className="text-ink-secondary">{ev.symbol.replace('USDT', '')}</span>
            <span className={ev.side === 'long' ? 'text-bear' : 'text-atlas'}>
              {ev.side === 'long' ? 'LARGO' : 'CORTO'}
            </span>
            <span className="text-ink-secondary">{ev.price.toFixed(2)}</span>
            <span className="text-right text-ink-primary">{formatNotional(ev.notional)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
