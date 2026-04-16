'use client'

import { useEffect, useMemo, useState } from 'react'
import { LiveClock } from '@/components/layout/LiveClock'
import { MobileNav } from '@/components/layout/MobileNav'
import type { MarketSession, OracleAlert } from '@/lib/oracle/types'
import { clsx } from 'clsx'
import { useTVQuote } from '@/hooks/useTVQuote'

interface TopBarProps {
  sessions?: MarketSession[]
  alerts?: OracleAlert[]
  title?: string
}

interface OracleStateResponse {
  success: boolean
  data?: {
    sessions: MarketSession[]
    alerts: OracleAlert[]
  }
}

const TICKER_SYMBOLS = ['XAUUSD', 'EURUSD', 'GBPUSD', 'BTCUSD', 'USDJPY']

function formatPrice(price: number | null, symbol: string): string {
  if (price === null) return '-'
  if (symbol === 'XAUUSD') return price.toFixed(2)
  if (symbol === 'BTCUSD') return price.toFixed(0)
  if (symbol.includes('JPY')) return price.toFixed(3)
  return price.toFixed(5)
}

export function TopBar({ sessions: initialSessions = [], alerts: initialAlerts = [] }: TopBarProps) {
  const { quotes } = useTVQuote(TICKER_SYMBOLS, 5000)
  const [sessions, setSessions] = useState<MarketSession[]>(initialSessions)
  const [alerts, setAlerts] = useState<OracleAlert[]>(initialAlerts)
  useEffect(() => {
    let mounted = true
    const fetchState = async () => {
      try {
        const response = await fetch('/api/oracle/state')
        const json = (await response.json()) as OracleStateResponse
        if (!mounted || !json.success || !json.data) return
        setSessions(json.data.sessions ?? [])
        setAlerts(json.data.alerts ?? [])
      } catch {
        if (!mounted) return
      }
    }

    fetchState()
    const timer = setInterval(fetchState, 60_000)
    return () => {
      mounted = false
      clearInterval(timer)
    }
  }, [])

  const unreadCount = useMemo(() => alerts.filter((alert) => !alert.read).length, [alerts])
  const criticalAlerts = useMemo(
    () => alerts.filter((alert) => alert.severity === 'critical' && !alert.read),
    [alerts],
  )

  const markAllAlertsAsRead = async () => {
    const unread = alerts.filter((alert) => !alert.read)
    if (unread.length === 0) return

    try {
      await Promise.all(
        unread.map((alert) =>
          fetch('/api/oracle/alerts', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: alert.id, read: true }),
          }),
        ),
      )
      setAlerts((previous) => previous.map((alert) => ({ ...alert, read: true })))
    } catch {
      // Keep local state untouched on failure.
    }
  }

  return (
    <header
      className="fixed top-0 left-0 md:left-[220px] right-0 h-11 flex items-center justify-between bg-bg-deep border-b border-bg-border z-20"
      style={{ boxShadow: '0 1px 0 0 #1C2236' }}
    >
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-oracle/30 to-transparent" />

      <div className="flex items-center min-w-0">
        <div className="flex items-center px-3 md:hidden">
          <MobileNav />
        </div>

        <div className="hidden md:flex items-center overflow-hidden">
          {TICKER_SYMBOLS.map((symbol, index) => {
            const quote = quotes[symbol]
            const changePct = quote?.changePct ?? null
            const up = (changePct ?? 0) >= 0
            return (
              <div
                key={symbol}
                className={clsx(
                  'flex items-center gap-2 px-4 h-11 border-r border-bg-border',
                  index === 0 && 'border-l border-bg-border',
                )}
              >
                <span className="text-[9px] font-mono text-ink-muted uppercase tracking-wider">
                  {symbol.replace('USD', '')}
                  <span className="text-ink-dim">/USD</span>
                </span>
                <span
                  className={clsx(
                    'text-[11px] font-mono font-semibold tabular-nums tracking-tight',
                    quote?.price ? (up ? 'text-bull' : 'text-bear') : 'text-ink-dim',
                  )}
                >
                  {formatPrice(quote?.price ?? null, symbol)}
                </span>
                {changePct !== null && (
                  <span className={clsx('text-[8px] font-mono tabular-nums', up ? 'text-bull/70' : 'text-bear/70')}>
                    {up ? '▲' : '▼'}
                    {Math.abs(changePct).toFixed(2)}%
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex items-center gap-0 shrink-0 ml-auto">
        {criticalAlerts.length > 0 && (
          <div className="hidden lg:flex items-center gap-2 px-3 h-11 border-l border-bg-border bg-bear/5">
            <span className="status-dot bg-bear animate-pulse-fast" style={{ width: 5, height: 5 }} />
            <span className="text-[9px] font-mono text-bear uppercase tracking-wider">{criticalAlerts[0]?.title}</span>
          </div>
        )}

        <div className="hidden lg:flex items-center gap-2 px-4 h-11 border-l border-bg-border">
          {sessions.map((session) => (
            <div key={session.name} className="flex items-center gap-1.5">
              <span
                className={clsx(
                  'status-dot',
                  session.isActive
                    ? session.killZone
                      ? 'bg-pulse animate-pulse-fast'
                      : 'bg-bull animate-pulse-slow'
                    : 'bg-bg-elevated',
                )}
                style={{ width: 4, height: 4 }}
              />
              <span
                className={clsx(
                  'text-[9px] font-mono tracking-wider uppercase',
                  session.isActive
                    ? session.killZone
                      ? 'text-pulse'
                      : 'text-bull'
                    : 'text-ink-dim',
                )}
              >
                {session.name.substring(0, 3)}
              </span>
            </div>
          ))}
        </div>

        <div className="w-px h-5 bg-bg-border mx-1" />

        <div className="flex items-center px-3 h-11">
          <LiveClock />
        </div>

        <div className="px-2 h-11 flex items-center border-l border-bg-border">
          <button
            onClick={markAllAlertsAsRead}
            className="relative flex items-center justify-center w-7 h-7 rounded bg-bg-card border border-bg-border hover:border-oracle/30 hover:bg-oracle/5 transition-all"
          >
            <svg className="w-3.5 h-3.5 text-ink-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
            </svg>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 bg-bear text-white text-[8px] font-mono font-bold rounded-full leading-none">
                {unreadCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  )
}
