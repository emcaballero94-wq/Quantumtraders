'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { clsx } from 'clsx'
import type { PublicAcademyRoute } from '@/lib/academy/content'
import { LESSON_EXTRAS, readMinutes } from '@/lib/academy/lesson-extras'

type Level = 'beginner' | 'intermediate' | 'advanced'

const LEVEL_META: Record<Level, { label: string; text: string; bg: string; border: string; ring: string; hex: string }> = {
  beginner: { label: 'Nivel 01 · Fundamentos', text: 'text-pulse', bg: 'bg-pulse', border: 'border-pulse', ring: 'shadow-[inset_2px_0_0_#F97316]', hex: '#F97316' },
  intermediate: { label: 'Nivel 02 · Ejecución y riesgo', text: 'text-atlas', bg: 'bg-atlas', border: 'border-atlas', ring: 'shadow-[inset_2px_0_0_#10B981]', hex: '#10B981' },
  advanced: { label: 'Nivel 03 · Edge profesional', text: 'text-nexus', bg: 'bg-nexus', border: 'border-nexus', ring: 'shadow-[inset_2px_0_0_#7C3AED]', hex: '#7C3AED' },
}

type AcademyProgress = { routeId: string; blockId: string; bestScore: number; passed: boolean; attempts: number }
type AcademyBadge = { id: string; badgeCode: string; routeId: string; routeTitle: string; issuedAt: string }
type RouteStatus = { routeId: string; completedBlocks: number; totalBlocks: number; completionPct: number; certified: boolean; badge: AcademyBadge | null }
type ExamEvaluation = {
  score: number
  passScore: number
  passed: boolean
  answers: Array<{ questionId: string; selectedIndex: number | null; isCorrect: boolean; explanation: string }>
}

type View = { kind: 'lesson'; blockId: string; index: number } | { kind: 'exam'; blockId: string }
type NodeState = 'done' | 'current' | 'open' | 'locked'

function getOrCreateLearnerId(): string {
  if (typeof window === 'undefined') return 'guest-web'
  const key = 'qt_learner_id'
  const existing = localStorage.getItem(key)
  if (existing) return existing
  const generated = `learner-${crypto.randomUUID().slice(0, 12)}`
  localStorage.setItem(key, generated)
  return generated
}

function loadDoneLessons(learnerId: string): Record<string, boolean> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(`qt_academy_done_${learnerId}`)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function StatusDot({ state, level, small }: { state: NodeState; level: Level; small?: boolean }) {
  const m = LEVEL_META[level]
  return (
    <span
      className={clsx(
        'rounded-full border-[1.5px] flex items-center justify-center font-bold text-bg-deep shrink-0',
        small ? 'w-3.5 h-3.5 text-[8px]' : 'w-[18px] h-[18px] text-[10px]',
        state === 'done' && [m.border, m.bg],
        state === 'current' && m.border,
        state === 'open' && 'border-ink-muted',
        state === 'locked' && 'border-bg-border',
      )}
      aria-hidden
    >
      {state === 'done' ? '✓' : ''}
    </span>
  )
}

export default function CoursesPage() {
  const [learnerId, setLearnerId] = useState('')
  const [routes, setRoutes] = useState<PublicAcademyRoute[]>([])
  const [progress, setProgress] = useState<AcademyProgress[]>([])
  const [routeStatus, setRouteStatus] = useState<RouteStatus[]>([])
  const [badges, setBadges] = useState<AcademyBadge[]>([])
  const [loading, setLoading] = useState(true)
  const [level, setLevel] = useState<Level>('beginner')
  const [doneLessons, setDoneLessons] = useState<Record<string, boolean>>({})
  const [doneLoaded, setDoneLoaded] = useState(false)
  const [view, setView] = useState<View | null>(null)
  const [checkAnswer, setCheckAnswer] = useState<number | null>(null)
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [submitting, setSubmitting] = useState(false)
  const [examFeedback, setExamFeedback] = useState<Record<string, ExamEvaluation>>({})
  const [verifyCode, setVerifyCode] = useState('')
  const [verifyResult, setVerifyResult] = useState<{ valid: boolean; routeTitle?: string } | null>(null)

  const fetchData = async (id: string) => {
    const [contentRes, progressRes] = await Promise.all([
      fetch('/api/academy/content'),
      fetch(`/api/academy/progress?learnerId=${encodeURIComponent(id)}`),
    ])
    const contentPayload = await contentRes.json()
    const progressPayload = await progressRes.json()
    setRoutes((contentPayload?.data?.routes ?? []) as PublicAcademyRoute[])
    setProgress((progressPayload?.data?.progress ?? []) as AcademyProgress[])
    setBadges((progressPayload?.data?.badges ?? []) as AcademyBadge[])
    setRouteStatus((progressPayload?.data?.routeStatus ?? []) as RouteStatus[])
  }

  useEffect(() => {
    let mounted = true
    const id = getOrCreateLearnerId()
    setLearnerId(id)
    setDoneLessons(loadDoneLessons(id))
    setDoneLoaded(true)
    fetchData(id).finally(() => mounted && setLoading(false))
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (!doneLoaded || !learnerId) return
    try {
      localStorage.setItem(`qt_academy_done_${learnerId}`, JSON.stringify(doneLessons))
    } catch {
      // ignore storage errors
    }
  }, [doneLessons, doneLoaded, learnerId])

  const route = routes.find((r) => r.level === level) ?? null
  const progressMap = useMemo(() => new Map(progress.map((p) => [`${p.routeId}:${p.blockId}`, p])), [progress])
  const statusMap = useMemo(() => new Map(routeStatus.map((s) => [s.routeId, s])), [routeStatus])

  const routeUnlocked = (lvl: Level) => {
    if (lvl === 'beginner') return true
    const prev = routes.find((r) => r.level === (lvl === 'intermediate' ? 'beginner' : 'intermediate'))
    return prev ? Boolean(statusMap.get(prev.id)?.certified || statusMap.get(prev.id)?.completionPct === 100) : false
  }

  const blockUnlocked = (r: PublicAcademyRoute, bi: number) => {
    if (!routeUnlocked(r.level as Level)) return false
    if (bi === 0) return true
    return Boolean(progressMap.get(`${r.id}:${r.blocks[bi - 1].id}`)?.passed)
  }

  const lessonKey = (r: PublicAcademyRoute, blockId: string, lessonId: string) => `${r.id}:${blockId}:${lessonId}`

  // Build states for sidebar and find the "current" lesson
  const tree = useMemo(() => {
    if (!route) return null
    let firstCurrent: View | null = null
    const blocks = route.blocks.map((block, bi) => {
      const unlocked = blockUnlocked(route, bi)
      let prevDone = true
      const lessons = block.lessons.map((lesson, li) => {
        const done = Boolean(doneLessons[lessonKey(route, block.id, lesson.id)])
        const state: NodeState = !unlocked ? 'locked' : done ? 'done' : prevDone ? 'current' : 'open'
        if (state === 'current' && !firstCurrent) firstCurrent = { kind: 'lesson', blockId: block.id, index: li }
        prevDone = done
        return { lesson, state }
      })
      const allDone = block.lessons.every((l) => doneLessons[lessonKey(route, block.id, l.id)])
      const passed = Boolean(progressMap.get(`${route.id}:${block.id}`)?.passed)
      const examState: NodeState = !unlocked || !allDone ? 'locked' : passed ? 'done' : 'current'
      if (examState === 'current' && !firstCurrent) firstCurrent = { kind: 'exam', blockId: block.id }
      return { block, bi, unlocked, lessons, examState, remaining: block.lessons.length - block.lessons.filter((l) => doneLessons[lessonKey(route, block.id, l.id)]).length }
    })
    const totalLessons = route.blocks.reduce((a, b) => a + b.lessons.length, 0)
    const doneCount = route.blocks.reduce((a, b) => a + b.lessons.filter((l) => doneLessons[lessonKey(route, b.id, l.id)]).length, 0)
    return { blocks, firstCurrent: firstCurrent as View | null, totalLessons, doneCount }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route, doneLessons, progressMap, statusMap])

  // Default view = first current node of the level
  useEffect(() => {
    if (!tree || !route) return
    if (view && route.blocks.some((b) => b.id === view.blockId)) return
    setView(tree.firstCurrent ?? { kind: 'lesson', blockId: route.blocks[0].id, index: 0 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tree, route])

  useEffect(() => setCheckAnswer(null), [view])

  if (loading || !route || !tree || !view) {
    return (
      <div className="space-y-4 animate-fade-in max-w-[1400px]">
        <div className="h-24 rounded-xl bg-bg-elevated animate-pulse" />
        <div className="h-[640px] rounded-xl bg-bg-elevated animate-pulse" />
      </div>
    )
  }

  const meta = LEVEL_META[level]
  const levelLocked = !routeUnlocked(level)
  const activeBlock = tree.blocks.find((b) => b.block.id === view.blockId) ?? tree.blocks[0]
  const activeLesson = view.kind === 'lesson' ? activeBlock.block.lessons[view.index] : null
  const extras = activeLesson ? LESSON_EXTRAS[activeLesson.id] : undefined

  // Flat list of lessons to compute prev/next across units
  const flat = tree.blocks.flatMap((b) => b.block.lessons.map((l, i) => ({ blockId: b.block.id, index: i, lesson: l, locked: !b.unlocked })))
  const flatIdx = activeLesson ? flat.findIndex((f) => f.lesson.id === activeLesson.id) : -1
  const prev = flatIdx > 0 ? flat[flatIdx - 1] : null

  const completeAndNext = () => {
    if (!activeLesson) return
    setDoneLessons((d) => ({ ...d, [lessonKey(route, activeBlock.block.id, activeLesson.id)]: true }))
    const nextInBlock = view.kind === 'lesson' && view.index + 1 < activeBlock.block.lessons.length
    if (nextInBlock) setView({ kind: 'lesson', blockId: activeBlock.block.id, index: (view as { index: number }).index + 1 })
    else setView({ kind: 'exam', blockId: activeBlock.block.id })
  }

  const submitExam = async () => {
    const block = activeBlock.block
    const answerArray = block.exam.questions.map((q) => {
      const v = answers[`${route.id}:${block.id}:${q.id}`]
      return Number.isInteger(v) ? v : null
    })
    setSubmitting(true)
    try {
      const res = await fetch('/api/academy/exam', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ learnerId, routeId: route.id, blockId: block.id, answers: answerArray }),
      })
      const payload = await res.json()
      if (payload?.success && payload.data?.evaluation) {
        setExamFeedback((f) => ({ ...f, [`${route.id}:${block.id}`]: payload.data.evaluation }))
        await fetchData(learnerId)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const verifyBadge = async () => {
    if (!verifyCode.trim()) return
    const res = await fetch(`/api/academy/badge/verify?code=${encodeURIComponent(verifyCode.trim().toUpperCase())}`)
    const payload = await res.json()
    setVerifyResult({ valid: Boolean(payload?.data?.valid), routeTitle: payload?.data?.badge?.routeTitle })
  }

  // Next milestone for the right panel
  const milestoneBlock = tree.blocks.find((b) => b.examState !== 'done') ?? null
  const feedback = examFeedback[`${route.id}:${activeBlock.block.id}`]
  const bestScore = progressMap.get(`${route.id}:${activeBlock.block.id}`)?.bestScore

  return (
    <div className="space-y-6 animate-fade-in pb-20 max-w-[1400px]">
      {/* Level tabs */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1.5">
          <p className="text-[11px] font-mono uppercase tracking-[0.16em] text-pulse">Academia · Trader development roadmap</p>
          <h1 className="text-2xl md:text-[28px] font-sans font-semibold tracking-tight text-ink-primary">De principiante a trader sistemático</h1>
        </div>
        <span className="text-[11px] font-mono text-ink-muted">Learner ID: {learnerId}</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {(['beginner', 'intermediate', 'advanced'] as const).map((lvl) => {
          const r = routes.find((x) => x.level === lvl)
          const st = r ? statusMap.get(r.id) : null
          const m = LEVEL_META[lvl]
          const locked = !routeUnlocked(lvl)
          return (
            <button
              key={lvl}
              type="button"
              onClick={() => {
                setLevel(lvl)
                setView(null)
              }}
              aria-pressed={level === lvl}
              className={clsx(
                'rounded-xl border px-4 py-3.5 text-left transition-colors',
                level === lvl ? `${m.border} bg-bg-card` : 'border-bg-border hover:bg-bg-card/60',
                locked && level !== lvl && 'opacity-60',
              )}
            >
              <div className="flex justify-between items-baseline gap-2">
                <span className={clsx('text-[10px] font-mono uppercase tracking-[0.14em]', m.text)}>{m.label}</span>
                <span className="text-[10px] font-mono text-ink-secondary">{r?.estimatedHours ?? '—'} h</span>
              </div>
              <p className="text-[15px] font-sans font-semibold text-ink-primary mt-1">{r?.title ?? '—'}</p>
              <div className="flex items-center gap-2.5 mt-2">
                <div className="flex-1 h-[3px] rounded-full bg-bg-border overflow-hidden">
                  <div className={clsx('h-full rounded-full', m.bg)} style={{ width: `${st?.completionPct ?? 0}%` }} />
                </div>
                <span className="text-[10px] font-mono text-ink-secondary">
                  {st?.certified ? `Certificado ${st.badge?.badgeCode ?? ''}` : locked ? 'Bloqueada' : `${st?.completedBlocks ?? 0}/${st?.totalBlocks ?? r?.blocks.length ?? 0} unidades`}
                </span>
              </div>
            </button>
          )
        })}
      </div>

      {/* Aula */}
      <div className="rounded-xl border border-bg-border bg-bg-base overflow-hidden grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)_320px] lg:min-h-[760px]">
        {/* Syllabus */}
        <nav className="bg-bg-deep border-b lg:border-b-0 lg:border-r border-bg-border px-5 py-6 flex flex-col gap-4 overflow-y-auto lg:max-h-[860px]" aria-label="Temario">
          <div className="space-y-2">
            <p className={clsx('text-[10px] font-mono uppercase tracking-[0.14em]', meta.text)}>{meta.label}</p>
            <p className="text-[17px] font-sans font-semibold text-ink-primary">{route.title}</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-[3px] rounded-full bg-bg-border overflow-hidden">
                <div className={clsx('h-full rounded-full', meta.bg)} style={{ width: `${(tree.doneCount / tree.totalLessons) * 100}%` }} />
              </div>
              <span className="text-[10px] font-mono text-ink-secondary">{tree.doneCount}/{tree.totalLessons}</span>
            </div>
            {levelLocked && <p className="text-xs font-sans text-ink-secondary">Se desbloquea al certificar la ruta anterior.</p>}
          </div>
          {tree.blocks.map(({ block, bi, lessons, examState }) => (
            <div key={block.id} className="flex flex-col gap-0.5">
              <p className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-muted py-1.5">Unidad {bi + 1} · {block.title}</p>
              {lessons.map(({ lesson, state }, li) => {
                const active = view.kind === 'lesson' && view.blockId === block.id && view.index === li
                return (
                  <button
                    key={lesson.id}
                    type="button"
                    disabled={state === 'locked'}
                    onClick={() => setView({ kind: 'lesson', blockId: block.id, index: li })}
                    className={clsx(
                      'flex items-center gap-2.5 px-2.5 py-2 rounded-md text-left transition-colors disabled:cursor-not-allowed',
                      active ? `bg-bg-card ${meta.ring}` : 'hover:bg-bg-card/60',
                    )}
                  >
                    <StatusDot state={state} level={level} small />
                    <span className={clsx('text-xs font-sans leading-snug', state === 'locked' ? 'text-ink-muted' : state === 'done' ? 'text-ink-secondary' : 'text-ink-primary')}>
                      {lesson.title}
                    </span>
                  </button>
                )
              })}
              <button
                type="button"
                disabled={examState === 'locked'}
                onClick={() => setView({ kind: 'exam', blockId: block.id })}
                className={clsx(
                  'flex items-center gap-2.5 px-2.5 py-2 rounded-md text-left text-xs font-sans transition-colors disabled:cursor-not-allowed',
                  view.kind === 'exam' && view.blockId === block.id ? `bg-bg-card ${meta.ring}` : 'hover:bg-bg-card/60',
                  examState === 'locked' ? 'text-ink-muted' : examState === 'done' ? meta.text : 'text-ink-primary',
                )}
              >
                <span className={clsx('w-2.5 h-2.5 rotate-45 border-[1.5px] mx-0.5 shrink-0', examState === 'locked' ? 'border-ink-muted' : meta.border, examState === 'done' && meta.bg)} aria-hidden />
                Examen · {block.exam.passScore}%{examState === 'done' ? ' · aprobado' : ''}
              </button>
            </div>
          ))}
        </nav>

        {/* Reader / exam */}
        <main className="px-6 md:px-14 py-10 flex flex-col gap-6 overflow-y-auto lg:max-h-[860px]">
          {activeLesson && (
            <>
              <p className="text-[11px] font-mono uppercase tracking-[0.14em] text-ink-secondary">
                Unidad {activeBlock.bi + 1} · Lección {(view as { index: number }).index + 1} de {activeBlock.block.lessons.length} · ≈ {readMinutes(activeLesson.content, activeLesson.keyPoints)} min
              </p>
              <h2 className="text-3xl md:text-[40px] font-sans font-semibold leading-[1.1] tracking-tight text-ink-primary max-w-[680px] text-balance">{activeLesson.title}</h2>
              <p className="font-serif text-lg md:text-[19px] leading-[1.75] text-ink-primary/85 max-w-[640px] text-pretty">{activeLesson.content}</p>
              <section className="max-w-[640px] rounded-xl border border-bg-border bg-bg-card px-6 py-5 space-y-3">
                <p className={clsx('text-[11px] font-mono uppercase tracking-[0.14em]', meta.text)}>Puntos clave</p>
                {activeLesson.keyPoints.map((kp, i) => (
                  <div key={kp} className="grid grid-cols-[24px_minmax(0,1fr)] gap-2.5 text-[15px] font-sans leading-relaxed text-ink-primary">
                    <span className={clsx('text-xs font-mono pt-0.5', meta.text)}>{String(i + 1).padStart(2, '0')}</span>
                    <span>{kp}</span>
                  </div>
                ))}
              </section>
              {extras?.apply && (
                <section className="max-w-[640px] grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] gap-4 items-center rounded-xl border border-oracle/35 bg-oracle/[0.06] px-6 py-5">
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-mono uppercase tracking-[0.14em] text-oracle">Aplícalo en la plataforma</p>
                    <p className="text-sm font-sans leading-relaxed text-ink-primary/85">{extras.apply.text}</p>
                  </div>
                  <Link href={extras.apply.href} className="text-[13px] font-sans font-medium text-bg-deep bg-oracle hover:bg-oracle/90 px-3.5 py-2.5 rounded-lg whitespace-nowrap transition-colors">
                    {extras.apply.cta} →
                  </Link>
                </section>
              )}
              <div className="max-w-[640px] flex flex-wrap justify-between items-center gap-3 pt-5 border-t border-bg-border">
                {prev && !prev.locked ? (
                  <button type="button" onClick={() => setView({ kind: 'lesson', blockId: prev.blockId, index: prev.index })} className="text-[13px] font-sans text-ink-secondary hover:text-ink-primary">
                    ← {prev.lesson.title}
                  </button>
                ) : (
                  <span />
                )}
                <button
                  type="button"
                  onClick={completeAndNext}
                  disabled={!activeBlock.unlocked}
                  className={clsx('text-sm font-sans font-semibold text-bg-deep px-[18px] py-3 rounded-[10px] transition-opacity hover:opacity-90 disabled:opacity-40', meta.bg)}
                >
                  Marcar como leída y seguir →
                </button>
              </div>
            </>
          )}

          {view.kind === 'exam' && (
            <>
              <p className="text-[11px] font-mono uppercase tracking-[0.14em] text-ink-secondary">Unidad {activeBlock.bi + 1} · Examen</p>
              <h2 className="text-3xl font-sans font-semibold tracking-tight text-ink-primary">{activeBlock.block.title}</h2>
              <p className="text-sm font-sans text-ink-secondary">
                Aprueba con {activeBlock.block.exam.passScore}% · {activeBlock.block.exam.questions.length} preguntas
                {bestScore != null && ` · mejor resultado: ${bestScore}`}
              </p>
              {activeBlock.examState === 'locked' ? (
                <p className="text-sm font-sans text-ink-secondary">Termina las {activeBlock.remaining} lecciones pendientes para habilitar el examen.</p>
              ) : (
                <div className="max-w-[640px] space-y-4">
                  {activeBlock.block.exam.questions.map((q, qi) => {
                    const key = `${route.id}:${activeBlock.block.id}:${q.id}`
                    const fb = feedback?.answers.find((a) => a.questionId === q.id)
                    return (
                      <fieldset key={q.id} className="rounded-xl border border-bg-border bg-bg-card px-5 py-4 space-y-3">
                        <legend className="sr-only">Pregunta {qi + 1}</legend>
                        <p className="text-[15px] font-sans font-medium text-ink-primary">{qi + 1}. {q.prompt}</p>
                        <div className="grid gap-2">
                          {q.options.map((opt, oi) => (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => setAnswers((a) => ({ ...a, [key]: oi }))}
                              aria-pressed={answers[key] === oi}
                              className={clsx(
                                'text-left text-sm font-sans px-3.5 py-2.5 rounded-lg border transition-colors',
                                answers[key] === oi ? `${meta.border} bg-bg-elevated text-ink-primary` : 'border-bg-border text-ink-primary/80 hover:border-ink-muted',
                              )}
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                        {fb && <p className={clsx('text-xs font-sans', fb.isCorrect ? 'text-atlas' : 'text-bear')}>{fb.isCorrect ? '✓ ' : '• '}{fb.explanation}</p>}
                      </fieldset>
                    )
                  })}
                  {feedback && (
                    <p className={clsx('text-sm font-sans font-semibold', feedback.passed ? 'text-atlas' : 'text-bear')}>
                      {feedback.passed ? 'Aprobado' : 'No aprobado'} · {feedback.score}/{feedback.passScore}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={submitExam}
                    disabled={submitting}
                    className={clsx('text-sm font-sans font-semibold text-bg-deep px-[18px] py-3 rounded-[10px] disabled:opacity-60', meta.bg)}
                  >
                    {submitting ? 'Evaluando…' : feedback ? 'Volver a rendir' : 'Enviar respuestas'}
                  </button>
                </div>
              )}
            </>
          )}
        </main>

        {/* Right panel */}
        <aside className="hidden xl:flex bg-bg-card border-l border-bg-border px-6 py-7 flex-col gap-[18px]">
          {activeLesson && extras?.check ? (
            <>
              <p className="text-[11px] font-mono uppercase tracking-[0.14em] text-ink-secondary">Comprueba lo aprendido</p>
              <p className="text-[17px] font-sans font-medium leading-snug text-ink-primary">{extras.check.prompt}</p>
              <div className="flex flex-col gap-2">
                {extras.check.options.map((opt, oi) => {
                  const answered = checkAnswer != null
                  const correct = oi === extras.check!.correctIndex
                  const picked = checkAnswer === oi
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setCheckAnswer(oi)}
                      className={clsx(
                        'text-left text-[13px] font-sans px-3.5 py-3 rounded-lg border transition-colors',
                        !answered && 'border-bg-border bg-bg-base text-ink-primary/85 hover:border-ink-muted',
                        answered && correct && 'border-atlas bg-atlas/[0.08] text-atlas',
                        answered && picked && !correct && 'border-bear bg-bear/[0.08] text-bear',
                        answered && !picked && !correct && 'border-bg-border bg-bg-base text-ink-secondary',
                      )}
                    >
                      {opt}
                    </button>
                  )
                })}
              </div>
              {checkAnswer != null && (
                <div className={clsx('rounded-lg px-3.5 py-3 space-y-1', checkAnswer === extras.check.correctIndex ? 'bg-atlas/[0.08]' : 'bg-bear/[0.08]')}>
                  <p className={clsx('text-[13px] font-sans font-semibold', checkAnswer === extras.check.correctIndex ? 'text-atlas' : 'text-bear')}>
                    {checkAnswer === extras.check.correctIndex ? '¡Correcto!' : 'No exactamente'}
                  </p>
                  <p className="text-[13px] font-sans leading-relaxed text-ink-primary/80">{extras.check.explanation}</p>
                </div>
              )}
            </>
          ) : (
            <p className="text-[13px] font-sans text-ink-secondary">Lee la lección y usa los puntos clave como repaso antes del examen.</p>
          )}

          <div className="mt-auto space-y-3 pt-[18px] border-t border-bg-border">
            <p className="text-[11px] font-mono uppercase tracking-[0.14em] text-ink-secondary">Próximo hito</p>
            {milestoneBlock ? (
              <div className="flex items-center gap-3">
                <span className={clsx('w-3.5 h-3.5 rotate-45 border-2 mx-[3px] shrink-0', meta.border)} aria-hidden />
                <div>
                  <p className="text-sm font-sans text-ink-primary">Examen Unidad {milestoneBlock.bi + 1}</p>
                  <p className="text-xs font-sans text-ink-secondary">
                    {milestoneBlock.block.exam.questions.length} preguntas · aprobar con {milestoneBlock.block.exam.passScore}%
                    {milestoneBlock.remaining > 0 && ` · faltan ${milestoneBlock.remaining} lecciones`}
                  </p>
                </div>
              </div>
            ) : (
              <p className={clsx('text-sm font-sans', meta.text)}>Ruta completada · certificado emitido</p>
            )}
          </div>
        </aside>
      </div>

      {/* Badges */}
      <section className="rounded-xl border border-bg-border px-5 py-5 space-y-3">
        <p className="text-[11px] font-mono uppercase tracking-[0.14em] text-ink-secondary">Certificados verificables</p>
        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_200px] gap-3">
          <input
            type="text"
            value={verifyCode}
            onChange={(e) => setVerifyCode(e.target.value)}
            placeholder="QTA-BEGINNER-XXXXXX"
            className="h-11 rounded-lg border border-bg-border bg-bg-deep px-4 text-sm font-mono text-ink-primary focus:outline-none focus:border-pulse"
          />
          <button type="button" onClick={verifyBadge} className="h-11 rounded-lg border border-bg-border text-sm font-sans text-ink-primary hover:border-ink-muted">
            Verificar certificado
          </button>
        </div>
        {verifyResult && (
          <p className={clsx('text-sm font-sans', verifyResult.valid ? 'text-atlas' : 'text-bear')}>
            {verifyResult.valid ? `Certificado válido · ${verifyResult.routeTitle ?? 'Ruta certificada'}` : 'Código inválido o no encontrado'}
          </p>
        )}
        {badges.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {badges.map((b) => (
              <span key={b.id} className="text-xs font-mono px-3 py-1.5 rounded-md border border-bg-border text-ink-primary">
                {b.routeTitle} · <span className="text-atlas">{b.badgeCode}</span>
              </span>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
