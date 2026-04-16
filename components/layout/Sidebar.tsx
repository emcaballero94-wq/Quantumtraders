'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { clsx } from 'clsx'
import type { ReactElement } from 'react'

// ─── Navigation Structure ──────────────────────────────────────
// Organised for a DAILY TRADER workflow:
//  1. Command (MANDO) — the cockpit, boot screen
//  2. Oracle — daily brief, session, economic calendar → context BEFORE trading
//  3. ATLAS — charts, price action, live data → WHERE to trade
//  4. NEXUS — correlations, DXY, macro context → WHY it moves
//  5. PULSE — alerts, news, sentiment → monitoring WHILE in trade
//  6. MIND — journal, trade log → AFTER the trade (review)
//  7. Tools — calculators, risk, lot sizing

const NAV: {
  section: string
  context: string
  items: { href: string; label: string; sub: string; dot: string; icon: (p: { cls: string }) => ReactElement }[]
}[] = [
  {
    section: 'COMMAND',
    context: 'Centro de control',
    items: [
      { href: '/dashboard',        label: 'MANDO',   sub: 'Cockpit',         dot: 'bg-ink-muted', icon: MandoIcon   },
      { href: '/dashboard/oracle', label: 'ORACLE',  sub: 'Brief diario',    dot: 'bg-oracle',    icon: OracleIcon  },
    ],
  },
  {
    section: 'ANÁLISIS',
    context: 'Antes de operar',
    items: [
      { href: '/dashboard/atlas',  label: 'ATLAS',   sub: 'Gráficos · Live', dot: 'bg-atlas',     icon: AtlasIcon   },
      { href: '/dashboard/nexus',  label: 'NEXUS',   sub: 'Correlaciones',   dot: 'bg-nexus',     icon: NexusIcon   },
    ],
  },
  {
    section: 'MONITOREO',
    context: 'Durante la operación',
    items: [
      { href: '/dashboard/pulse',  label: 'PULSE',   sub: 'Alertas · Noticias', dot: 'bg-pulse',  icon: PulseIcon   },
    ],
  },
  {
    section: 'SISTEMA',
    context: 'Revisión y herramientas',
    items: [
      { href: '/dashboard/mind',   label: 'MIND',    sub: 'Diario · Journal', dot: 'bg-atlas',   icon: MindIcon    },
      { href: '/dashboard/courses', label: 'COURSES', sub: 'Ruta + Certificación', dot: 'bg-oracle', icon: CoursesIcon },
      { href: '/dashboard/billing', label: 'BILLING', sub: 'Pagos cripto',     dot: 'bg-nexus',   icon: BillingIcon },
      { href: '/dashboard/tools',  label: 'TOOLS',   sub: 'Calculadoras',     dot: 'bg-ink-muted', icon: ToolsIcon  },
    ],
  },
]

// ─── Sidebar ────────────────────────────────────────────────────
export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="h-full w-full flex flex-col bg-bg-deep relative overflow-hidden">
      {/* Top edge accent */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-oracle/40 to-transparent" />

      {/* ── Logo ───────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-bg-border">
        {/* Animated QT mark */}
        <div className="relative flex items-center justify-center w-8 h-8 rounded-md bg-oracle-dim border border-oracle/20 shrink-0">
          <span className="text-oracle text-[11px] font-mono font-bold tracking-tight leading-none">QT</span>
          <span className="absolute inset-0 rounded-md border border-oracle/10 animate-glow-pulse" style={{ animationDelay: '0.5s' }} />
        </div>
        <div className="leading-none">
          <p className="text-ink-primary text-[11px] font-mono font-bold tracking-[0.18em] uppercase">QUANTUM</p>
          <p className="text-ink-muted text-[9px] font-mono tracking-[0.22em] uppercase mt-0.5">Traders · OS</p>
        </div>
      </div>

      {/* ── Session / Market Status strip ─────────────────── */}
      <div className="px-4 py-2.5 border-b border-bg-border">
        <MarketStatusStrip />
      </div>

      {/* ── Nav ────────────────────────────────────────────── */}
      <nav className="flex-1 px-2 py-3 space-y-4 overflow-y-auto">
        {NAV.map(({ section, context, items }) => (
          <div key={section}>
            {/* Section header */}
            <div className="flex items-center gap-2 px-2 mb-1.5">
              <span className="text-[8.5px] font-mono text-ink-dim tracking-[0.25em] uppercase font-semibold">{section}</span>
              <div className="flex-1 h-px bg-bg-border" />
            </div>

            {/* Items */}
            <ul className="space-y-0.5">
              {items.map(({ href, label, sub, dot, icon: Icon }) => {
                const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      className={clsx(
                        'relative flex items-center gap-2.5 px-2.5 py-2 rounded-md transition-all duration-150 group',
                        active
                          ? 'bg-bg-elevated text-ink-primary'
                          : 'text-ink-muted hover:text-ink-secondary hover:bg-bg-elevated/50',
                      )}
                    >
                      {/* Active left accent bar */}
                      {active && (
                        <span className={clsx('absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-full', dot)} />
                      )}

                      {/* Icon */}
                      <Icon cls={clsx(
                        'w-3.5 h-3.5 shrink-0 transition-colors',
                        active ? dot.replace('bg-', 'text-') : 'text-ink-dim group-hover:text-ink-muted'
                      )} />

                      {/* Labels */}
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-mono font-semibold tracking-[0.15em] uppercase leading-none">
                          {label}
                        </p>
                        <p className="text-[8.5px] font-mono text-ink-dim mt-0.5 truncate">{sub}</p>
                      </div>

                      {/* Live indicator for ATLAS & PULSE */}
                      {(href === '/dashboard/atlas' || href === '/dashboard/pulse') && (
                        <span className={clsx('status-dot shrink-0', dot, 'animate-pulse-slow opacity-70')} style={{ width: 4, height: 4 }} />
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* ── Bottom ─────────────────────────────────────────── */}
      <div className="border-t border-bg-border px-2 py-3 space-y-0.5">
        <Link
          href="/settings"
          className={clsx(
            'flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[10px] font-mono tracking-wider uppercase transition-all',
            pathname === '/settings'
              ? 'bg-bg-elevated text-ink-secondary'
              : 'text-ink-dim hover:text-ink-muted hover:bg-bg-elevated/50'
          )}
        >
          <SettingsIcon cls="w-3.5 h-3.5 shrink-0" />
          <span>Settings</span>
        </Link>

        {/* User */}
        <div className="flex items-center gap-2.5 px-2.5 py-2">
          <div className="w-5 h-5 rounded-full bg-oracle-dim border border-oracle/20 flex items-center justify-center shrink-0">
            <span className="text-[8px] text-oracle font-mono font-bold">T</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[9px] font-mono text-ink-secondary truncate">Trader Pro</p>
            <p className="text-[8px] font-mono text-ink-dim">Session activa</p>
          </div>
          <span className="status-dot bg-bull animate-pulse-slow" style={{ width: 5, height: 5 }} />
        </div>
      </div>

      {/* Bottom edge accent */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-bg-border to-transparent" />
    </aside>
  )
}

// ─── Market Status Strip ────────────────────────────────────────
function MarketStatusStrip() {
  const now = new Date()
  const hour = now.getUTCHours()
  // Rough session detection
  const sessions = [
    { name: 'LDN', active: hour >= 7  && hour < 16,  color: 'text-atlas'  },
    { name: 'NY',  active: hour >= 12 && hour < 21,  color: 'text-oracle' },
    { name: 'TKY', active: hour >= 0  && hour < 9,   color: 'text-nexus'  },
    { name: 'SYD', active: hour >= 21 || hour < 6,   color: 'text-pulse'  },
  ]
  const overlap = sessions.filter(s => s.active).length > 1

  return (
    <div className="flex items-center justify-between gap-1">
      {sessions.map(s => (
        <div key={s.name} className="flex items-center gap-1">
          <span className={clsx(
            'status-dot shrink-0',
            s.active ? `${s.color.replace('text-', 'bg-')} animate-pulse-slow` : 'bg-bg-elevated'
          )} style={{ width: 4, height: 4 }} />
          <span className={clsx(
            'text-[8.5px] font-mono tracking-wider',
            s.active ? s.color : 'text-ink-dim'
          )}>
            {s.name}
          </span>
        </div>
      ))}
      {overlap && (
        <span className="text-[7.5px] font-mono text-pulse uppercase tracking-wider px-1 py-0.5 rounded bg-pulse/10 border border-pulse/20">
          OVERLAP
        </span>
      )}
    </div>
  )
}

// ─── Icons ────────────────────────────────────────────────────
function MandoIcon({ cls }: { cls: string }) {
  return (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
    </svg>
  )
}
function OracleIcon({ cls }: { cls: string }) {
  return (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}
function AtlasIcon({ cls }: { cls: string }) {
  return (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
    </svg>
  )
}
function NexusIcon({ cls }: { cls: string }) {
  return (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
    </svg>
  )
}
function PulseIcon({ cls }: { cls: string }) {
  return (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h2.25l2.25-6.75L11.25 18l2.25-9 2.25 6.75h2.25m0 0h1.5" />
    </svg>
  )
}
function MindIcon({ cls }: { cls: string }) {
  return (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
    </svg>
  )
}
function ToolsIcon({ cls }: { cls: string }) {
  return (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
    </svg>
  )
}
function BillingIcon({ cls }: { cls: string }) {
  return (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M3 6h18a.75.75 0 01.75.75v10.5A.75.75 0 0121 18H3a.75.75 0 01-.75-.75V6.75A.75.75 0 013 6z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 14.25h3m-10.5 0h3" />
    </svg>
  )
}
function CoursesIcon({ cls }: { cls: string }) {
  return (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 14L3 9l9-5 9 5-9 5z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 9v6l9 5 9-5V9" />
    </svg>
  )
}
function SettingsIcon({ cls }: { cls: string }) {
  return (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}
