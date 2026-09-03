'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { computeTradeAudit } from '@/lib/journal/audit-engine'
import type { TradeJournalEntry, TradeChecklist } from '@/lib/oracle/persistence'
import type { OracleState } from '@/lib/oracle/types'
import type { PublicAcademyRoute } from '@/lib/academy/content'
import { clsx } from 'clsx'

interface OracleStateResponse {
  success: boolean
  data: OracleState | null
}

interface AcademyContentResponse {
  success: boolean
  data: { routes: PublicAcademyRoute[] }
}

interface AcademyProgressRow {
  routeId: string
  blockId: string
  bestScore: number
  passed: boolean
}

interface AcademyProgressResponse {
  success: boolean
  data: { progress: AcademyProgressRow[] }
}

interface ApiTrade {
  id: string
  symbol: string
  side: 'BUY' | 'SELL'
  result: string
  profit: number
  createdAt: string
  entryPrice: number | null
  stopLoss: number | null
  takeProfit: number | null
  exitPrice: number | null
  lotSize: number | null
  commission: number
  swap: number
  checklist?: TradeChecklist | null
}

interface BlockWithProgress {
  routeId: string
  routeLevel: string
  blockId: string
  title: string
  objective: string
  score: number
  passed: boolean
}

function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 19) return 'Good afternoon'
  return 'Good evening'
}

function isToday(iso: string): boolean {
  return iso.slice(0, 10) === new Date().toISOString().slice(0, 10)
}

export default function DashboardPage() {
  const [userLabel, setUserLabel] = useState<string | null>(null)
  const [state, setState] = useState<OracleState | null>(null)
  const [routes, setRoutes] = useState<PublicAcademyRoute[]>([])
  const [progress, setProgress] = useState<AcademyProgressRow[]>([])
  const [trades, setTrades] = useState<TradeJournalEntry[]>([])
  const [checklists, setChecklists] = useState<Record<string, TradeChecklist>>({})

  useEffect(() => {
    const supabase = createClient()
    if (!supabase) return
    supabase.auth.getUser().then((result: { data: { user: { email?: string } | null } }) => {
      const email = result.data.user?.email
      setUserLabel(email ? email.split('@')[0] : null)
    })
  }, [])

  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        const [statePayload, contentPayload, progressPayload, tradesPayload] = await Promise.all([
          fetch('/api/oracle/state').then((r) => r.json() as Promise<OracleStateResponse>),
          fetch('/api/academy/content').then((r) => r.json() as Promise<AcademyContentResponse>),
          fetch('/api/academy/progress').then((r) => r.json() as Promise<AcademyProgressResponse>),
          fetch('/api/journal/trades').then((r) => r.json()),
        ])
        if (!mounted) return
        if (statePayload.success) setState(statePayload.data)
        if (contentPayload.success) setRoutes(contentPayload.data.routes)
        if (progressPayload.success) setProgress(progressPayload.data.progress)

        const items = (tradesPayload?.data ?? []) as ApiTrade[]
        setTrades(items.map((item): TradeJournalEntry => ({
          id: item.id,
          symbol: item.symbol,
          side: item.side,
          result: item.result,
          profit: item.profit,
          entryPrice: item.entryPrice,
          stopLoss: item.stopLoss,
          takeProfit: item.takeProfit,
          exitPrice: item.exitPrice,
          lotSize: item.lotSize,
          commission: item.commission,
          swap: item.swap,
          closedAt: null,
          source: 'manual',
          notes: null,
          createdAt: item.createdAt,
        })))
        const checklistMap: Record<string, TradeChecklist> = {}
        for (const item of items) if (item.checklist) checklistMap[item.id] = item.checklist
        setChecklists(checklistMap)
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

  // ── Trading Development: every real academy block, scored from real progress ──
  const blocks: BlockWithProgress[] = useMemo(() => {
    const progressMap = new Map(progress.map((p) => [`${p.routeId}:${p.blockId}`, p]))
    return routes.flatMap((route) =>
      route.blocks.map((block) => {
        const p = progressMap.get(`${route.id}:${block.id}`)
        return {
          routeId: route.id,
          routeLevel: route.level,
          blockId: block.id,
          title: block.title,
          objective: block.objective,
          score: p?.bestScore ?? 0,
          passed: p?.passed ?? false,
        }
      }),
    )
  }, [routes, progress])

  const nextBlock = blocks.find((b) => !b.passed) ?? null
  const allComplete = blocks.length > 0 && nextBlock === null

  // ── Trading snapshot: real trades, via the same audit engine as Trade Audit ──
  const todayTrades = useMemo(() => trades.filter((t) => isToday(t.createdAt)), [trades])
  const todayClosed = todayTrades.filter((t) => t.result !== 'OPEN')
  const todayPnL = todayClosed.reduce((sum, t) => sum + t.profit - t.commission - t.swap, 0)

  const last30dTrades = useMemo(() => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000
    return trades.filter((t) => new Date(t.createdAt).getTime() >= cutoff)
  }, [trades])
  const audit30d = useMemo(() => computeTradeAudit(last30dTrades, checklists), [last30dTrades, checklists])

  // ── Market status: minimal context, not the full Scanner ──
  const activeSession = state?.sessions.find((s) => s.isActive)?.name ?? null
  const marketGlance = useMemo(() => (state ? [...state.radar].sort((a, b) => b.totalScore - a.totalScore).slice(0, 3) : []), [state])

  return (
    <div className="space-y-5">
      {/* ── Greeting ── */}
      <div>
        <h1 className="text-xl font-mono font-bold text-ink-primary tracking-tight">
          {greeting()}{userLabel ? `, ${userLabel.toUpperCase()}` : ''}
        </h1>
        <p className="text-xs font-mono text-ink-muted mt-0.5">Your trading workspace</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

        {/* ── Continue Learning ── */}
        <div className="lg:col-span-7 rounded-xl border border-bg-border bg-bg-card glass-card p-5">
          <p className="text-[9px] font-mono text-ink-dim uppercase tracking-widest mb-2">Continue Where You Left Off</p>
          {allComplete ? (
            <p className="text-sm font-mono text-atlas">All roadmap levels complete — nice work.</p>
          ) : nextBlock ? (
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-mono text-oracle uppercase tracking-wider">{nextBlock.routeLevel} · {nextBlock.title}</p>
                <p className="text-xs font-mono text-ink-secondary mt-1 max-w-md">{nextBlock.objective}</p>
              </div>
              <Link
                href="/dashboard/courses"
                className="shrink-0 px-4 py-2 bg-oracle/10 text-oracle border border-oracle/30 rounded-lg text-[10px] font-mono font-bold uppercase tracking-widest hover:bg-oracle/20 transition-all"
              >
                Continue →
              </Link>
            </div>
          ) : (
            <p className="text-xs font-mono text-ink-dim">Loading your roadmap...</p>
          )}
        </div>

        {/* ── Today ── */}
        <div className="lg:col-span-5 rounded-xl border border-bg-border bg-bg-card glass-card p-5">
          <p className="text-[9px] font-mono text-ink-dim uppercase tracking-widest mb-3">Today</p>
          <div className="grid grid-cols-2 gap-3 text-xs font-mono">
            <div>
              <p className="text-ink-dim uppercase text-[9px]">Trades logged</p>
              <p className="text-ink-primary font-bold text-lg tabular-nums">{todayTrades.length}</p>
            </div>
            <div>
              <p className="text-ink-dim uppercase text-[9px]">Next lesson</p>
              <p className="text-ink-primary font-bold truncate">{nextBlock ? nextBlock.title : '—'}</p>
            </div>
          </div>
          {todayTrades.length > 0 && (
            <Link href="/dashboard/tools" className="inline-block mt-3 text-[10px] font-mono text-oracle hover:underline uppercase tracking-wider">
              Review today's trades →
            </Link>
          )}
        </div>

        {/* ── Trading Development ── */}
        <div className="lg:col-span-7 rounded-xl border border-bg-border bg-bg-card glass-card p-5 space-y-3">
          <p className="text-[9px] font-mono text-ink-dim uppercase tracking-widest">Trading Development</p>
          {blocks.length === 0 ? (
            <p className="text-xs font-mono text-ink-dim">Loading roadmap progress...</p>
          ) : (
            <div className="space-y-2.5">
              {blocks.map((b) => (
                <div key={b.blockId} className="flex items-center gap-3">
                  <span className="text-[10px] font-mono text-ink-secondary w-44 truncate">{b.title}</span>
                  <div className="flex-1 h-1.5 bg-bg-deep rounded-full overflow-hidden">
                    <div
                      className={clsx('h-full rounded-full transition-all duration-700', b.passed ? 'bg-atlas' : b.score > 0 ? 'bg-oracle' : 'bg-bg-border')}
                      style={{ width: `${b.score}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-mono text-ink-dim w-8 text-right tabular-nums">{b.score}%</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Your Trading ── */}
        <div className="lg:col-span-5 rounded-xl border border-bg-border bg-bg-card glass-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-[9px] font-mono text-ink-dim uppercase tracking-widest">Your Trading</p>
            <span className="text-[9px] font-mono text-ink-dim uppercase">Today</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-lg font-mono font-bold text-ink-primary tabular-nums">{todayClosed.length}</p>
              <p className="text-[8.5px] font-mono text-ink-dim uppercase">Trades</p>
            </div>
            <div>
              <p className={clsx('text-lg font-mono font-bold tabular-nums', todayPnL >= 0 ? 'text-atlas' : 'text-bear')}>
                {todayPnL >= 0 ? '+' : ''}${todayPnL.toFixed(0)}
              </p>
              <p className="text-[8.5px] font-mono text-ink-dim uppercase">P&amp;L</p>
            </div>
            <div>
              <p className="text-lg font-mono font-bold text-ink-primary tabular-nums">{todayClosed.length > 0 ? '✓' : '—'}</p>
              <p className="text-[8.5px] font-mono text-ink-dim uppercase">Logged</p>
            </div>
          </div>
          <div className="border-t border-bg-border pt-3">
            <p className="text-[9px] font-mono text-ink-dim uppercase tracking-widest mb-2">Last 30 Days</p>
            <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono">
              <div>
                <p className="text-ink-primary font-bold tabular-nums">{audit30d.profitFactor === null ? '—' : audit30d.profitFactor === Infinity ? '∞' : audit30d.profitFactor.toFixed(2)}</p>
                <p className="text-[8px] text-ink-dim uppercase">PF</p>
              </div>
              <div>
                <p className="text-ink-primary font-bold tabular-nums">{audit30d.winRate === null ? '—' : `${audit30d.winRate.toFixed(0)}%`}</p>
                <p className="text-[8px] text-ink-dim uppercase">Win Rate</p>
              </div>
              <div>
                <p className="text-ink-primary font-bold tabular-nums">{audit30d.maxDrawdown === null ? '—' : `$${audit30d.maxDrawdown.toFixed(0)}`}</p>
                <p className="text-[8px] text-ink-dim uppercase">Max DD</p>
              </div>
            </div>
          </div>
          <Link href="/dashboard/tools" className="block text-center text-[10px] font-mono text-oracle hover:underline uppercase tracking-wider">
            View Trade Audit →
          </Link>
        </div>

        {/* ── Market Status (mini) ── */}
        <div className="lg:col-span-12 rounded-xl border border-bg-border bg-bg-card glass-card p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[9px] font-mono text-ink-dim uppercase tracking-widest">Market Status</p>
            <div className="flex items-center gap-1.5">
              <span className={clsx('w-1.5 h-1.5 rounded-full', activeSession ? 'bg-atlas animate-pulse-slow' : 'bg-ink-dim')} />
              <span className="text-[10px] font-mono text-ink-secondary">{activeSession ? `${activeSession} session active` : 'No major session active'}</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {marketGlance.map((asset) => (
              <div key={asset.symbol} className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-bg-border bg-bg-elevated/30">
                <span className="text-xs font-mono font-bold text-ink-primary">{asset.symbol}</span>
                <span className={clsx(
                  'text-[10px] font-mono uppercase',
                  asset.bias === 'long' ? 'text-atlas' : asset.bias === 'short' ? 'text-bear' : 'text-ink-muted',
                )}>
                  {asset.bias === 'long' ? 'Bullish' : asset.bias === 'short' ? 'Bearish' : 'Neutral'}
                </span>
              </div>
            ))}
            <Link href="/dashboard/scanner" className="ml-auto text-[10px] font-mono text-oracle hover:underline uppercase tracking-wider">
              Open Scanner →
            </Link>
          </div>
        </div>

      </div>
    </div>
  )
}
