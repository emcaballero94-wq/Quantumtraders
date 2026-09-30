'use client'

import { useEffect, useRef, useState } from 'react'
import { clsx } from 'clsx'

interface DerivativesPanelProps {
  /** Binance USDT-M perpetual symbol, lowercase (e.g. 'btcusdt'). */
  symbol: string
}

interface OiPoint {
  time: number
  value: number
}

const MAX_OI_POINTS = 60
const OI_POLL_MS = 30_000

export function DerivativesPanel({ symbol }: DerivativesPanelProps) {
  const [fundingRate, setFundingRate] = useState<number | null>(null)
  const [nextFundingTime, setNextFundingTime] = useState<number | null>(null)
  const [markPrice, setMarkPrice] = useState<number | null>(null)
  const [wsStatus, setWsStatus] = useState<'connecting' | 'live' | 'error'>('connecting')

  const [openInterest, setOpenInterest] = useState<number | null>(null)
  const [oiSeries, setOiSeries] = useState<OiPoint[]>([])
  const [oiStatus, setOiStatus] = useState<'loading' | 'live' | 'error'>('loading')

  const [now, setNow] = useState(() => Date.now())
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Funding rate + mark price: Binance streams these live, updated every
  // second, well before the funding settlement itself (every 8h).
  useEffect(() => {
    let cancelled = false
    setFundingRate(null)
    setNextFundingTime(null)
    setMarkPrice(null)

    function connect() {
      setWsStatus('connecting')
      const ws = new WebSocket(`wss://fstream.binance.com/ws/${symbol}@markPrice@1s`)
      wsRef.current = ws

      ws.onopen = () => {
        if (!cancelled) setWsStatus('live')
      }

      ws.onmessage = (event) => {
        if (cancelled) return
        try {
          const payload = JSON.parse(event.data)
          const rate = Number.parseFloat(payload?.r)
          const nextTime = Number(payload?.T)
          const mark = Number.parseFloat(payload?.p)
          if (Number.isFinite(rate)) setFundingRate(rate)
          if (Number.isFinite(nextTime)) setNextFundingTime(nextTime)
          if (Number.isFinite(mark)) setMarkPrice(mark)
        } catch {
          // Ignore a single malformed frame — the next tick corrects it.
        }
      }

      ws.onerror = () => {
        if (!cancelled) setWsStatus('error')
      }

      ws.onclose = () => {
        if (cancelled) return
        setWsStatus('error')
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

  // Open interest has no public WebSocket stream on Binance — poll the
  // REST endpoint instead. It doesn't move fast enough to need less than 30s.
  useEffect(() => {
    let cancelled = false
    setOpenInterest(null)
    setOiSeries([])
    setOiStatus('loading')

    async function poll() {
      try {
        const response = await fetch(
          `https://fapi.binance.com/fapi/v1/openInterest?symbol=${symbol.toUpperCase()}`,
        )
        if (!response.ok) throw new Error(`status ${response.status}`)
        const payload = await response.json()
        const value = Number.parseFloat(payload?.openInterest)
        if (cancelled || !Number.isFinite(value)) return
        setOpenInterest(value)
        setOiSeries((prev) => [...prev, { time: Date.now(), value }].slice(-MAX_OI_POINTS))
        setOiStatus('live')
      } catch {
        if (!cancelled) setOiStatus('error')
      }
    }

    poll()
    const interval = setInterval(poll, OI_POLL_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [symbol])

  // Local ticker just to keep the funding countdown fresh.
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])

  const countdownMs = nextFundingTime !== null ? Math.max(0, nextFundingTime - now) : null
  const countdownLabel =
    countdownMs !== null
      ? `${Math.floor(countdownMs / 3_600_000)}h ${Math.floor((countdownMs % 3_600_000) / 60_000)}m`
      : '—'

  const notional = openInterest !== null && markPrice !== null ? openInterest * markPrice : null
  const baseAsset = symbol.replace('usdt', '').toUpperCase()

  return (
    <div className="rounded-xl border border-bg-border bg-bg-base overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-bg-border">
        <span className="text-xs font-mono uppercase tracking-[0.12em] text-ink-secondary">
          Derivados · {symbol.replace('usdt', '/USDT').toUpperCase()}
        </span>
        <span
          className={clsx(
            'flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider',
            wsStatus === 'live' ? 'text-atlas' : wsStatus === 'error' ? 'text-bear' : 'text-ink-dim',
          )}
        >
          <span
            className={clsx(
              'w-1.5 h-1.5 rounded-full',
              wsStatus === 'live' ? 'bg-atlas animate-pulse' : wsStatus === 'error' ? 'bg-bear' : 'bg-ink-dim',
            )}
          />
          {wsStatus === 'live' ? 'En vivo' : wsStatus === 'error' ? 'Reconectando…' : 'Conectando…'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 px-5 py-4">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-wider text-ink-secondary mb-1">Funding actual</p>
          <p
            className={clsx(
              'text-lg font-mono tabular-nums',
              fundingRate === null ? 'text-ink-dim' : fundingRate >= 0 ? 'text-atlas' : 'text-bear',
            )}
          >
            {fundingRate !== null ? `${(fundingRate * 100).toFixed(4)}%` : '—'}
          </p>
          <p className="text-[10px] font-mono text-ink-dim mt-1">Próximo en {countdownLabel}</p>
        </div>

        <div>
          <p className="text-[10px] font-mono uppercase tracking-wider text-ink-secondary mb-1">Open Interest</p>
          <p className="text-lg font-mono tabular-nums text-ink-primary">
            {openInterest !== null
              ? `${openInterest.toLocaleString('en-US', { maximumFractionDigits: 0 })} ${baseAsset}`
              : '—'}
          </p>
          <p className="text-[10px] font-mono text-ink-dim mt-1">
            {notional !== null
              ? `≈ $${(notional / 1_000_000).toFixed(1)}M nocional`
              : oiStatus === 'error'
                ? 'Sin datos'
                : 'Cargando…'}
          </p>
        </div>
      </div>

      {oiSeries.length > 1 && (
        <div className="px-5 pb-4">
          <OiSparkline series={oiSeries} />
        </div>
      )}
    </div>
  )
}

function OiSparkline({ series }: { series: OiPoint[] }) {
  const width = 100
  const height = 28

  const values = series.map((p) => p.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1

  const points = series
    .map((p, i) => {
      const x = (i / (series.length - 1)) * width
      const y = height - ((p.value - min) / range) * height
      return `${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(' ')

  const trendingUp = values[values.length - 1] >= values[0]

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-7" preserveAspectRatio="none">
      <polyline
        points={points}
        fill="none"
        strokeWidth="1.5"
        className={trendingUp ? 'stroke-atlas' : 'stroke-bear'}
      />
    </svg>
  )
}
