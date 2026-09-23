'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { clsx } from 'clsx'

type ApiTrade = {
  id: string
  symbol: string
  side: 'BUY' | 'SELL'
  result: string
  profit: number
  commission: number
  swap: number
  lotSize: number | null
  createdAt: string
  checklist?: { emotionTag?: string | null; mistakeTag?: string | null } | null
}

type Rules = { dailyLoss: number; maxLossStreak: number; maxTrades: number; cooldownMin: number }

const DEFAULT_RULES: Rules = { dailyLoss: 300, maxLossStreak: 3, maxTrades: 4, cooldownMin: 15 }
const RULES_KEY = 'qt_mind_rules'
const PAUSE_KEY = 'qt_mind_paused_until'

const EMOTION_COLOR: Record<string, string> = {
  Tranquilo: '#10B981',
  Confiado: '#E8B44C',
  Ansioso: '#F97316',
  FOMO: '#EF4444',
  Frustrado: '#EF4444',
}

const net = (t: ApiTrade) => t.profit - (t.commission ?? 0) - (t.swap ?? 0)
const closed = (t: ApiTrade) => t.result !== 'OPEN'
const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const money = (v: number) => `${v >= 0 ? '+' : '−'}$${Math.abs(Math.round(v)).toLocaleString('en-US')}`

function sessionOf(d: Date) {
  const h = d.getUTCHours()
  if (h >= 13 && h < 21) return 'Nueva York'
  if (h >= 7 && h < 13) return 'Londres'
  return 'Asia'
}

function RuleRow({ label, value, pct, state }: { label: string; value: string; pct: number; state: 'ok' | 'warn' | 'breach' }) {
  const color = state === 'ok' ? 'bg-atlas' : state === 'warn' ? 'bg-pulse' : 'bg-bear'
  const text = state === 'ok' ? 'text-atlas' : state === 'warn' ? 'text-pulse' : 'text-bear'
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_96px] gap-4 items-center py-4 border-t border-bg-border">
      <div className="space-y-2">
        <div className="flex justify-between gap-3">
          <span className="text-[15px] font-sans text-ink-primary">{label}</span>
          <span className="text-[13px] font-mono text-ink-secondary tabular-nums">{value}</span>
        </div>
        <div className="h-1.5 rounded-full bg-bg-elevated overflow-hidden">
          <div className={clsx('h-full rounded-full transition-all', color)} style={{ width: `${Math.min(100, pct)}%` }} />
        </div>
      </div>
      <span className={clsx('text-right text-xs font-sans font-medium', text)}>
        {state === 'ok' ? 'OK' : state === 'warn' ? 'Atención' : 'Incumplida'}
      </span>
    </div>
  )
}

export default function MindPage() {
  const [trades, setTrades] = useState<ApiTrade[]>([])
  const [loading, setLoading] = useState(true)
  const [rules, setRules] = useState<Rules>(DEFAULT_RULES)
  const [editing, setEditing] = useState(false)
  const [pausedUntil, setPausedUntil] = useState<number | null>(null)
  const [breathing, setBreathing] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    try {
      const r = localStorage.getItem(RULES_KEY)
      if (r) setRules({ ...DEFAULT_RULES, ...JSON.parse(r) })
      const p = Number(localStorage.getItem(PAUSE_KEY))
      if (p && p > Date.now()) setPausedUntil(p)
    } catch {
      // ignore storage errors
    }
    let mounted = true
    fetch('/api/journal/trades')
      .then((r) => r.json())
      .then((payload) => mounted && setTrades((payload?.data ?? []) as ApiTrade[]))
      .catch(() => mounted && setTrades([]))
      .finally(() => mounted && setLoading(false))
    const tick = setInterval(() => setNow(Date.now()), 30_000)
    return () => {
      mounted = false
      clearInterval(tick)
    }
  }, [])

  useEffect(() => {
    if (!breathing) return
    const t = setTimeout(() => setBreathing(false), 120_000)
    return () => clearTimeout(t)
  }, [breathing])

  const saveRules = (next: Rules) => {
    setRules(next)
    try {
      localStorage.setItem(RULES_KEY, JSON.stringify(next))
    } catch {
      // ignore
    }
  }

  const pauseUntilTomorrow = () => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    d.setHours(0, 0, 0, 0)
    setPausedUntil(d.getTime())
    try {
      localStorage.setItem(PAUSE_KEY, String(d.getTime()))
    } catch {
      // ignore
    }
  }

  const sorted = useMemo(() => [...trades].sort((a, b) => a.createdAt.localeCompare(b.createdAt)), [trades])

  // ── Tilt monitor (today) ──
  const today = useMemo(() => {
    const key = dayKey(new Date(now))
    const list = sorted.filter((t) => dayKey(new Date(t.createdAt)) === key)
    const closedList = list.filter(closed)
    const pnl = closedList.reduce((a, t) => a + net(t), 0)
    let streak = 0
    for (let i = closedList.length - 1; i >= 0 && net(closedList[i]) < 0; i--) streak++
    // Shortest gap between a losing trade and the next entry
    let minGap: number | null = null
    for (let i = 1; i < list.length; i++) {
      if (closed(list[i - 1]) && net(list[i - 1]) < 0) {
        const gap = (new Date(list[i].createdAt).getTime() - new Date(list[i - 1].createdAt).getTime()) / 60_000
        minGap = minGap == null ? gap : Math.min(minGap, gap)
      }
    }
    return { list, pnl, streak, minGap, count: list.length }
  }, [sorted, now])

  const ruleStates = useMemo(() => {
    const lossUsed = today.pnl < 0 ? Math.abs(today.pnl) / rules.dailyLoss : 0
    const st = (ratio: number): 'ok' | 'warn' | 'breach' => (ratio >= 1 ? 'breach' : ratio >= 0.6 ? 'warn' : 'ok')
    const cooldownRatio = today.minGap == null ? 0 : today.minGap < rules.cooldownMin ? 1 : 0
    return [
      { label: 'Pérdida diaria máxima', value: `${today.pnl < 0 ? money(today.pnl) : '$0'} de −$${rules.dailyLoss}`, pct: lossUsed * 100, state: st(lossUsed) },
      { label: 'Pérdidas seguidas', value: `${today.streak} de ${rules.maxLossStreak}`, pct: (today.streak / rules.maxLossStreak) * 100, state: st(today.streak / rules.maxLossStreak) },
      { label: 'Operaciones hoy', value: `${today.count} de ${rules.maxTrades}`, pct: (today.count / rules.maxTrades) * 100, state: st(today.count / rules.maxTrades) },
      {
        label: 'Espera tras una pérdida',
        value: today.minGap == null ? `mín. ${rules.cooldownMin} min` : `${Math.round(today.minGap)} min de ${rules.cooldownMin}`,
        pct: today.minGap == null ? 0 : Math.min(100, (rules.cooldownMin / Math.max(today.minGap, 1)) * 50),
        state: (cooldownRatio >= 1 ? 'breach' : 'ok') as 'ok' | 'breach',
      },
    ]
  }, [today, rules])

  const tiltScore = useMemo(() => {
    const w = ruleStates.reduce((a, r) => a + (r.state === 'breach' ? 30 : r.state === 'warn' ? 15 : Math.min(10, r.pct / 10)), 0)
    return Math.min(100, Math.round(w))
  }, [ruleStates])

  const tilt =
    tiltScore >= 60 ? { label: 'Para ahora', color: 'text-bear', stroke: '#EF4444' }
    : tiltScore >= 30 ? { label: 'Precaución', color: 'text-pulse', stroke: '#F97316' }
    : { label: 'En control', color: 'text-atlas', stroke: '#10B981' }

  const tiltReason = (() => {
    const parts: string[] = []
    if (today.streak >= 2) parts.push(`${today.streak} pérdidas seguidas`)
    if (today.minGap != null && today.minGap < rules.cooldownMin) parts.push(`una entrada ${Math.round(today.minGap)} min después de perder`)
    if (today.count >= rules.maxTrades) parts.push('límite de operaciones alcanzado')
    if (parts.length === 0) return today.count === 0 ? 'Sin operaciones hoy. Empieza con tu plan.' : 'Tus reglas se están respetando.'
    return `${parts.join(' y ')}. Baja el ritmo.`.replace(/^./, (c) => c.toUpperCase())
  })()

  // ── Espejo (last 20 trading days) ──
  const mirror = useMemo(() => {
    const byDay = new Map<string, ApiTrade[]>()
    for (const t of sorted) {
      const k = dayKey(new Date(t.createdAt))
      byDay.set(k, [...(byDay.get(k) ?? []), t])
    }
    const days = [...byDay.entries()].slice(-20).map(([k, list]) => {
      const counts = new Map<string, number>()
      for (const t of list) {
        const e = t.checklist?.emotionTag
        if (e) counts.set(e, (counts.get(e) ?? 0) + 1)
      }
      const mood = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
      const pnl = list.filter(closed).reduce((a, t) => a + net(t), 0)
      return { k, mood, pnl, label: String(Number(k.slice(8))) }
    })
    const maxAbs = Math.max(1, ...days.map((d) => Math.abs(d.pnl)))

    const closedAll = sorted.filter(closed)
    const byEmotion = new Map<string, { n: number; w: number }>()
    for (const t of closedAll) {
      const e = t.checklist?.emotionTag
      if (!e) continue
      const s = byEmotion.get(e) ?? { n: 0, w: 0 }
      s.n++
      if (net(t) > 0) s.w++
      byEmotion.set(e, s)
    }
    const emoRates = [...byEmotion.entries()].filter(([, s]) => s.n >= 3).map(([e, s]) => ({ e, rate: Math.round((s.w / s.n) * 100), n: s.n }))
    const best = [...emoRates].sort((a, b) => b.rate - a.rate)[0] ?? null
    const worst = [...emoRates].sort((a, b) => a.rate - b.rate)[0] ?? null

    // Win rate on the trade right after 2 consecutive losses
    let afterN = 0
    let afterW = 0
    for (let i = 2; i < closedAll.length; i++) {
      if (net(closedAll[i - 1]) < 0 && net(closedAll[i - 2]) < 0) {
        afterN++
        if (net(closedAll[i]) > 0) afterW++
      }
    }
    const bySession = new Map<string, number>()
    for (const t of closedAll) bySession.set(sessionOf(new Date(t.createdAt)), (bySession.get(sessionOf(new Date(t.createdAt))) ?? 0) + net(t))
    const bestSession = [...bySession.entries()].sort((a, b) => b[1] - a[1])[0] ?? null
    const byMistake = new Map<string, number>()
    for (const t of closedAll) {
      const m = t.checklist?.mistakeTag
      if (m && net(t) < 0) byMistake.set(m, (byMistake.get(m) ?? 0) + net(t))
    }
    const costly = [...byMistake.entries()].sort((a, b) => a[1] - b[1])[0] ?? null

    const patterns = [
      afterN >= 3 && {
        k: 'Después de 2 pérdidas',
        tone: 'text-bear',
        t: `Tu win rate en la siguiente operación es del ${Math.round((afterW / afterN) * 100)}%.`,
        d: `Basado en ${afterN} casos. Considera una pausa de ${rules.cooldownMin * 2} min tras la segunda pérdida.`,
      },
      bestSession && {
        k: 'Mejor sesión',
        tone: 'text-atlas',
        t: `Ganas más en ${bestSession[0]}: ${money(bestSession[1])}.`,
        d: 'Concentra tu energía en esa ventana.',
      },
      costly && {
        k: 'Error más caro',
        tone: 'text-pulse',
        t: `“${costly[0]}” te ha costado ${money(costly[1])}.`,
        d: 'Añádelo como punto explícito en tu checklist pre-trade.',
      },
    ].filter(Boolean) as { k: string; tone: string; t: string; d: string }[]

    return { days, maxAbs, best, worst, patterns, tagged: closedAll.filter((t) => t.checklist?.emotionTag).length }
  }, [sorted, rules.cooldownMin])

  const circumference = 2 * Math.PI * 92
  const paused = pausedUntil != null && pausedUntil > now

  if (loading) {
    return (
      <div className="space-y-4 animate-fade-in max-w-[1280px]">
        <div className="h-[420px] rounded-xl bg-bg-elevated animate-pulse" />
        <div className="h-[320px] rounded-xl bg-bg-elevated animate-pulse" />
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-fade-in pb-20 max-w-[1280px]">
      {paused && (
        <div className="rounded-xl border border-pulse/40 bg-pulse/[0.06] px-5 py-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-sans text-ink-primary">
            Pausa activa hasta {new Date(pausedUntil!).toLocaleString('es-ES', { weekday: 'long', hour: '2-digit', minute: '2-digit' })}. Usa el tiempo para revisar tus trades o estudiar.
          </p>
          <Link href="/dashboard/courses" className="text-[13px] font-sans text-pulse hover:text-pulse/80">Ir a la Academia →</Link>
        </div>
      )}

      {/* Tilt monitor */}
      <section className="rounded-xl border border-bg-border bg-bg-deep overflow-hidden grid grid-cols-1 lg:grid-cols-[400px_minmax(0,1fr)]">
        <div className="px-8 py-9 lg:border-r border-bg-border flex flex-col gap-5 bg-[radial-gradient(320px_260px_at_50%_38%,rgba(249,115,22,0.08),transparent_70%)]">
          <p className="text-[11px] font-mono uppercase tracking-[0.16em] text-atlas">Mind · Monitor de tilt · hoy</p>
          <div className="relative w-[220px] h-[220px] self-center">
            <svg width="220" height="220" viewBox="0 0 220 220" aria-hidden>
              <circle cx="110" cy="110" r="92" fill="none" stroke="#1C1815" strokeWidth="14" />
              <circle
                cx="110"
                cy="110"
                r="92"
                fill="none"
                stroke={tilt.stroke}
                strokeWidth="14"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={circumference * (1 - tiltScore / 100)}
                transform="rotate(-90 110 110)"
                className="transition-[stroke-dashoffset] duration-500"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
              <span className="text-[52px] font-mono leading-none text-ink-primary tabular-nums">{tiltScore}</span>
              <span className="text-xs font-sans text-ink-secondary">riesgo de tilt</span>
            </div>
          </div>
          <div className="flex flex-col items-center text-center gap-1.5">
            <p className={clsx('text-2xl font-sans font-semibold', tilt.color)}>{tilt.label}</p>
            <p className="text-sm font-sans leading-relaxed text-ink-primary/80 max-w-[320px] text-pretty">{tiltReason}</p>
          </div>
          <div className="flex gap-2 mt-auto">
            <button
              type="button"
              onClick={() => setBreathing((b) => !b)}
              className={clsx(
                'flex-1 text-[13px] font-sans py-3 rounded-lg border transition-colors',
                breathing ? 'border-atlas text-atlas bg-atlas/10' : 'border-bg-border text-ink-primary hover:border-ink-muted',
              )}
            >
              {breathing ? 'Inhala 4 · Exhala 6…' : 'Respirar 2 min'}
            </button>
            <button
              type="button"
              onClick={pauseUntilTomorrow}
              disabled={paused}
              className="flex-1 text-[13px] font-sans font-semibold py-3 rounded-lg bg-pulse text-bg-deep hover:bg-pulse/90 disabled:opacity-50"
            >
              {paused ? 'Pausado' : 'Pausar hasta mañana'}
            </button>
          </div>
        </div>

        <div className="px-8 py-8 flex flex-col gap-2 min-w-0">
          <div className="flex justify-between items-baseline pb-2">
            <h1 className="text-[22px] font-sans font-medium text-ink-primary">Reglas de hoy</h1>
            <button type="button" onClick={() => setEditing((e) => !e)} className="text-[13px] font-sans text-ink-secondary hover:text-ink-primary">
              {editing ? 'Listo' : 'Editar reglas →'}
            </button>
          </div>
          {editing && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pb-3">
              {([
                ['dailyLoss', 'Pérdida diaria ($)'],
                ['maxLossStreak', 'Pérdidas seguidas'],
                ['maxTrades', 'Operaciones / día'],
                ['cooldownMin', 'Espera tras pérdida (min)'],
              ] as const).map(([k, label]) => (
                <label key={k} className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-sans text-ink-secondary">{label}</span>
                  <input
                    type="number"
                    min={1}
                    value={rules[k]}
                    onChange={(e) => saveRules({ ...rules, [k]: Math.max(1, Number(e.target.value) || 1) })}
                    className="h-10 rounded-lg border border-bg-border bg-bg-card px-3 font-mono text-sm text-ink-primary focus:outline-none focus:border-atlas"
                  />
                </label>
              ))}
            </div>
          )}
          {ruleStates.map((r) => (
            <RuleRow key={r.label} {...r} />
          ))}

          <div className="pt-4 space-y-2.5">
            <p className="text-[11px] font-mono uppercase tracking-[0.14em] text-ink-secondary">Línea de tiempo · hoy</p>
            {today.list.length === 0 ? (
              <p className="text-[13px] font-sans text-ink-muted">Sin operaciones registradas hoy.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {today.list.map((t) => {
                  const c = !closed(t) ? 'border-pulse text-pulse' : net(t) >= 0 ? 'border-atlas text-atlas' : 'border-bear text-bear'
                  return (
                    <span key={t.id} className={clsx('text-[11px] font-mono px-2.5 py-1.5 rounded-md border tabular-nums', c)}>
                      {new Date(t.createdAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} · {t.symbol} · {closed(t) ? money(net(t)) : 'abierta'}
                    </span>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Espejo */}
      <section className="rounded-xl border border-bg-border bg-bg-base px-6 md:px-10 py-9 flex flex-col gap-8">
        <div className="space-y-2.5">
          <p className="text-[11px] font-mono uppercase tracking-[0.16em] text-atlas">Espejo · últimos 20 días operados</p>
          <h2 className="text-2xl md:text-[34px] font-sans font-medium leading-tight tracking-tight text-ink-primary max-w-4xl text-pretty">
            {mirror.best && mirror.worst && mirror.best.e !== mirror.worst.e ? (
              <>
                Cuando operas <span style={{ color: EMOTION_COLOR[mirror.best.e] }}>{mirror.best.e.toLowerCase()}</span> ganas el {mirror.best.rate}% de las veces. Con{' '}
                <span style={{ color: EMOTION_COLOR[mirror.worst.e] }}>{mirror.worst.e.toLowerCase()}</span>, el {mirror.worst.rate}%.
              </>
            ) : (
              'Etiqueta la emoción de tus operaciones para ver cómo influye en tus resultados.'
            )}
          </h2>
          {mirror.tagged < 10 && (
            <p className="text-[13px] font-sans text-ink-secondary">
              {mirror.tagged} operaciones etiquetadas. Con 10 o más, los patrones empiezan a ser fiables.{' '}
              <Link href="/dashboard/tools" className="text-atlas hover:text-atlas/80">Registrar en Trade Audit →</Link>
            </p>
          )}
        </div>

        {mirror.days.length > 0 && (
          <div className="overflow-x-auto">
            <div className="min-w-[640px] space-y-2.5">
              <div className="grid gap-1 items-center" style={{ gridTemplateColumns: `72px repeat(${mirror.days.length}, minmax(0, 1fr))` }}>
                <span className="text-[11px] font-sans text-ink-secondary">Estado</span>
                {mirror.days.map((d) => (
                  <div key={`m-${d.k}`} title={d.mood ?? 'Sin etiqueta'} className="h-[34px] rounded" style={{ background: d.mood ? EMOTION_COLOR[d.mood] ?? '#7A6F5C' : '#1C1815' }} />
                ))}
                <span className="text-[11px] font-sans text-ink-secondary">P/L</span>
                {mirror.days.map((d) => {
                  const h = Math.max(2, (Math.abs(d.pnl) / mirror.maxAbs) * 28)
                  return (
                    <div key={`p-${d.k}`} title={money(d.pnl)} className="relative h-[60px] flex flex-col items-center justify-center">
                      <div className="absolute inset-x-0 top-[30px] h-px bg-bg-border" />
                      <div
                        className={clsx('w-[70%] rounded-sm', d.pnl >= 0 ? 'bg-atlas' : 'bg-bear')}
                        style={{ height: h, marginTop: d.pnl >= 0 ? 0 : h, marginBottom: d.pnl >= 0 ? h : 0 }}
                      />
                    </div>
                  )
                })}
                <span />
                {mirror.days.map((d) => (
                  <span key={`l-${d.k}`} className="text-center text-[9px] font-mono text-ink-muted">{d.label}</span>
                ))}
              </div>
              <div className="flex flex-wrap gap-4 pl-[76px] text-[11px] font-sans text-ink-secondary">
                {[['Tranquilo', '#10B981'], ['Confiado', '#E8B44C'], ['Ansioso', '#F97316'], ['FOMO / frustrado', '#EF4444']].map(([l, c]) => (
                  <span key={l} className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: c }} />{l}</span>
                ))}
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-bg-elevated" />Sin etiqueta</span>
              </div>
            </div>
          </div>
        )}

        {mirror.patterns.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {mirror.patterns.map((p) => (
              <div key={p.k} className="rounded-xl border border-bg-border bg-bg-card p-[22px] space-y-2.5">
                <p className={clsx('text-[11px] font-mono uppercase tracking-[0.14em]', p.tone)}>{p.k}</p>
                <p className="text-[17px] font-sans font-medium leading-snug text-ink-primary text-pretty">{p.t}</p>
                <p className="text-[13px] font-sans leading-relaxed text-ink-secondary text-pretty">{p.d}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
