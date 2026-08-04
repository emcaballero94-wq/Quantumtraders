'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { SessionBadge } from '@/components/ui/StatusBadge'
import { MobileNav } from '@/components/layout/MobileNav'
import { getActiveSessions } from '@/lib/oracle/timing-engine'
import type { OracleAlert } from '@/lib/oracle/types'

interface TopBarProps {
  title?: string
}

function formatUTCTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour:     '2-digit',
    minute:   '2-digit',
    second:   '2-digit',
    hour12:   false,
    timeZone: 'UTC',
  }) + ' UTC'
}

export function TopBar({ title }: TopBarProps) {
  const [now, setNow] = useState<Date | null>(null)
  const [sessions, setSessions] = useState(() => getActiveSessions())
  const [alerts, setAlerts] = useState<OracleAlert[]>([])

  useEffect(() => {
    const tick = () => {
      setNow(new Date())
      setSessions(getActiveSessions())
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    let mounted = true
    const fetchAlerts = async () => {
      try {
        const res = await fetch('/api/oracle/alerts')
        const payload = await res.json()
        if (mounted && payload?.success && Array.isArray(payload.data)) {
          setAlerts(payload.data)
        }
      } catch {
        // keep last known alerts on transient failure
      }
    }
    fetchAlerts()
    const id = setInterval(fetchAlerts, 60_000)
    return () => {
      mounted = false
      clearInterval(id)
    }
  }, [])

  const unreadCount = alerts.filter((a) => !a.read).length
  const criticalAlerts = alerts.filter((a) => a.severity === 'critical' && !a.read)

  return (
    <header className="fixed top-0 left-0 md:left-[220px] right-0 h-12 flex items-center justify-between px-4 md:px-5 bg-bg-deep border-b border-bg-border z-20">

      {/* Left: mobile nav trigger + title */}
      <div className="flex items-center gap-3">
        <MobileNav />
        {title && (
          <h1 className="text-xs font-mono font-semibold text-ink-secondary tracking-[0.15em] uppercase">
            {title}
          </h1>
        )}
        {criticalAlerts.length > 0 && (
          <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 bg-bear/10 border border-bear/30 rounded text-2xs font-mono text-bear">
            <span className="w-1.5 h-1.5 bg-bear rounded-full animate-pulse-slow" />
            {criticalAlerts[0]?.title}
          </div>
        )}
      </div>

      {/* Right: sessions + clock + alerts */}
      <div className="flex items-center gap-3">

        {/* Active sessions */}
        <div className="hidden md:flex items-center gap-1.5">
          {sessions.map((s) => (
            <SessionBadge
              key={s.name}
              name={s.name}
              isActive={s.isActive}
              killZone={s.killZone}
            />
          ))}
        </div>

        <div className="hidden md:block w-px h-4 bg-bg-border" />

        {/* Clock — suppressHydrationWarning: intentionally blank on first SSR paint, ticks client-side */}
        <span className="text-xs font-mono text-ink-muted tabular-nums hidden sm:inline" suppressHydrationWarning>
          {now ? formatUTCTime(now) : '--:--:-- UTC'}
        </span>

        {/* Alerts bell */}
        <Link
          href="/dashboard/oracle"
          className="relative flex items-center justify-center w-7 h-7 rounded bg-bg-card border border-bg-border hover:border-oracle/30 transition-colors"
          aria-label={unreadCount > 0 ? `${unreadCount} alertas sin leer` : 'Ver alertas'}
        >
          <svg className="w-3.5 h-3.5 text-ink-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
          </svg>
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 bg-bear text-white text-2xs font-mono font-bold rounded-full">
              {unreadCount}
            </span>
          )}
        </Link>
      </div>
    </header>
  )
}
