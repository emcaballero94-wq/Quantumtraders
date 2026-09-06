'use client'

import { useEffect, useMemo, useState } from 'react'
import { clsx } from 'clsx'
import type { AcademyLesson, PublicAcademyRoute } from '@/lib/academy/content'
import { useLocale } from '@/lib/i18n/LocaleProvider'
import { LearningPath, type PathNodeData, type PathNodeState } from '@/components/academy/LearningPath'
import { LessonModal } from '@/components/academy/LessonModal'

const LEVEL_KEY: Record<'beginner' | 'intermediate' | 'advanced', string> = {
  beginner: 'level1',
  intermediate: 'level2',
  advanced: 'level3',
}
const LEVEL_SUB_KEY: Record<'beginner' | 'intermediate' | 'advanced', string> = {
  beginner: 'level1Sub',
  intermediate: 'level2Sub',
  advanced: 'level3Sub',
}
const ROUTE_ACCENT: Record<'beginner' | 'intermediate' | 'advanced', 'oracle' | 'atlas' | 'nexus'> = {
  beginner: 'oracle',
  intermediate: 'atlas',
  advanced: 'nexus',
}
const ACCENT_UI: Record<'oracle' | 'atlas' | 'nexus', { tabActive: string; text: string; bannerActive: string }> = {
  oracle: { tabActive: 'border-oracle/40 bg-oracle/10', text: 'text-oracle', bannerActive: 'border-oracle/30 bg-oracle/5' },
  atlas: { tabActive: 'border-atlas/40 bg-atlas/10', text: 'text-atlas', bannerActive: 'border-atlas/30 bg-atlas/5' },
  nexus: { tabActive: 'border-nexus/40 bg-nexus/10', text: 'text-nexus', bannerActive: 'border-nexus/30 bg-nexus/5' },
}

type AcademyProgress = {
  learnerId: string
  routeId: string
  blockId: string
  bestScore: number
  passed: boolean
  attempts: number
  completedAt: string | null
  updatedAt: string
}

type AcademyBadge = {
  id: string
  badgeCode: string
  learnerId: string
  routeId: string
  routeTitle: string
  issuedAt: string
}

type RouteStatus = {
  routeId: string
  completedBlocks: number
  totalBlocks: number
  completionPct: number
  certified: boolean
  badge: AcademyBadge | null
}

type ExamResponse = {
  success: boolean
  data?: {
    learnerId: string
    evaluation: ExamEvaluation
    routeCompletion: {
      completedBlocks: number
      totalBlocks: number
      completionPct: number
      certified: boolean
    } | null
    badge: AcademyBadge | null
  }
  error?: string
}

type ExamEvaluation = {
  routeId: string
  blockId: string
  score: number
  passScore: number
  passed: boolean
  answers: Array<{
    questionId: string
    selectedIndex: number | null
    isCorrect: boolean
    explanation: string
  }>
}

interface ActiveLesson {
  routeId: string
  blockId: string
  lessons: AcademyLesson[]
  index: number
}

function getOrCreateLearnerId(): string {
  if (typeof window === 'undefined') return 'guest-web'
  const storageKey = 'qt_learner_id'
  const existing = localStorage.getItem(storageKey)
  if (existing) return existing
  const generated = `learner-${crypto.randomUUID().slice(0, 12)}`
  localStorage.setItem(storageKey, generated)
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

export default function CoursesPage() {
  const { t } = useLocale()
  const [learnerId, setLearnerId] = useState('')
  const [routes, setRoutes] = useState<PublicAcademyRoute[]>([])
  const [progress, setProgress] = useState<AcademyProgress[]>([])
  const [routeStatus, setRouteStatus] = useState<RouteStatus[]>([])
  const [badges, setBadges] = useState<AcademyBadge[]>([])
  const [level, setLevel] = useState<'beginner' | 'intermediate' | 'advanced'>('beginner')
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [submitting, setSubmitting] = useState<string | null>(null)
  const [examFeedback, setExamFeedback] = useState<Record<string, ExamEvaluation>>({})
  const [verifyCode, setVerifyCode] = useState('')
  const [verifyResult, setVerifyResult] = useState<{ valid: boolean; routeTitle?: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [doneLessons, setDoneLessons] = useState<Record<string, boolean>>({})
  const [doneLoaded, setDoneLoaded] = useState(false)
  const [activeLesson, setActiveLesson] = useState<ActiveLesson | null>(null)
  const [activeExamKey, setActiveExamKey] = useState<string | null>(null)

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
    const init = async () => {
      const id = getOrCreateLearnerId()
      if (!mounted) return
      setLearnerId(id)
      setDoneLessons(loadDoneLessons(id))
      setDoneLoaded(true)
      try {
        await fetchData(id)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    init()
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (!doneLoaded || !learnerId) return
    try {
      localStorage.setItem(`qt_academy_done_${learnerId}`, JSON.stringify(doneLessons))
    } catch {
      // ignore quota/storage errors
    }
  }, [doneLessons, doneLoaded, learnerId])

  const visibleRoutes = useMemo(
    () => routes.filter((route) => route.level === level),
    [routes, level],
  )

  const setAnswer = (routeId: string, blockId: string, questionId: string, selectedIndex: number) => {
    const key = `${routeId}:${blockId}:${questionId}`
    setAnswers((prev) => ({ ...prev, [key]: selectedIndex }))
  }

  const submitExam = async (routeId: string, blockId: string, questionIds: string[]) => {
    if (!learnerId) return
    const answerArray = questionIds.map((questionId) => {
      const key = `${routeId}:${blockId}:${questionId}`
      return Number.isInteger(answers[key]) ? answers[key] : null
    })

    const submitKey = `${routeId}:${blockId}`
    setSubmitting(submitKey)
    try {
      const response = await fetch('/api/academy/exam', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          learnerId,
          routeId,
          blockId,
          answers: answerArray,
        }),
      })
      const payload = (await response.json()) as ExamResponse
      if (payload.success && payload.data?.evaluation) {
        setExamFeedback((prev) => ({
          ...prev,
          [submitKey]: payload.data!.evaluation,
        }))
        await fetchData(learnerId)
      }
    } finally {
      setSubmitting(null)
    }
  }

  const verifyBadge = async () => {
    if (!verifyCode.trim()) return
    const response = await fetch(`/api/academy/badge/verify?code=${encodeURIComponent(verifyCode.trim().toUpperCase())}`)
    const payload = await response.json()
    setVerifyResult({
      valid: Boolean(payload?.data?.valid),
      routeTitle: payload?.data?.badge?.routeTitle,
    })
  }

  const routeStatusMap = new Map(routeStatus.map((status) => [status.routeId, status]))
  const progressMap = new Map(progress.map((row) => [`${row.routeId}:${row.blockId}`, row]))

  const openLesson = (routeId: string, blockId: string, lessons: AcademyLesson[], index: number) => {
    setActiveLesson({ routeId, blockId, lessons, index })
  }

  const completeActiveLesson = () => {
    if (!activeLesson) return
    const lesson = activeLesson.lessons[activeLesson.index]
    const key = `${activeLesson.routeId}:${activeLesson.blockId}:${lesson.id}`
    setDoneLessons((prev) => ({ ...prev, [key]: true }))
    const nextIndex = activeLesson.index + 1
    if (nextIndex < activeLesson.lessons.length) {
      setActiveLesson({ ...activeLesson, index: nextIndex })
    } else {
      setActiveLesson(null)
    }
  }

  const isBlockUnlocked = (route: PublicAcademyRoute, blockIndex: number): boolean => {
    if (blockIndex === 0) return true
    const prevBlock = route.blocks[blockIndex - 1]
    return Boolean(progressMap.get(`${route.id}:${prevBlock.id}`)?.passed)
  }

  const buildBlockNodes = (route: PublicAcademyRoute, block: PublicAcademyRoute['blocks'][number], unlocked: boolean): PathNodeData[] => {
    const nodes: PathNodeData[] = []
    let previousDone = true
    block.lessons.forEach((lesson, i) => {
      const key = `${route.id}:${block.id}:${lesson.id}`
      const done = Boolean(doneLessons[key])
      let state: PathNodeState
      if (!unlocked) state = 'locked'
      else if (done) state = 'done'
      else if (previousDone) state = 'current'
      else state = 'locked'
      nodes.push({
        id: lesson.id,
        kind: 'lesson',
        label: lesson.title,
        state,
        onClick: state === 'locked' ? undefined : () => openLesson(route.id, block.id, block.lessons, i),
      })
      previousDone = done
    })

    const allLessonsDone = block.lessons.every((lesson) => doneLessons[`${route.id}:${block.id}:${lesson.id}`])
    const blockProgress = progressMap.get(`${route.id}:${block.id}`)
    let checkpointState: PathNodeState
    if (!unlocked || !allLessonsDone) checkpointState = 'locked'
    else if (blockProgress?.passed) checkpointState = 'done'
    else checkpointState = 'current'

    nodes.push({
      id: `${block.id}-checkpoint`,
      kind: 'checkpoint',
      label: 'Examen',
      state: checkpointState,
      onClick: checkpointState === 'locked' ? undefined : () => setActiveExamKey(`${route.id}:${block.id}`),
    })
    return nodes
  }

  const activeExamRoute = activeExamKey ? routes.find((r) => activeExamKey.startsWith(`${r.id}:`)) : null
  const activeExamBlock = activeExamRoute && activeExamKey
    ? activeExamRoute.blocks.find((b) => activeExamKey === `${activeExamRoute.id}:${b.id}`)
    : null

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="flex items-center justify-between border-b border-bg-border pb-4">
        <div>
          <p className="text-[10px] font-mono text-oracle uppercase tracking-[0.2em] mb-1">{t('roadmap.kicker')}</p>
          <h1 className="text-xl font-mono font-bold text-ink-primary tracking-tight">{t('roadmap.title')}</h1>
          <p className="text-xs font-mono text-ink-muted mt-1 max-w-md">{t('roadmap.subtitle')}</p>
        </div>
        <span className="text-[10px] font-mono text-ink-dim uppercase">Learner ID: {learnerId || '--'}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {(['beginner', 'intermediate', 'advanced'] as const).map((targetLevel) => {
          const route = routes.find((item) => item.level === targetLevel)
          const status = route ? routeStatusMap.get(route.id) : null
          const accentUi = ACCENT_UI[ROUTE_ACCENT[targetLevel]]
          return (
            <button
              key={targetLevel}
              onClick={() => setLevel(targetLevel)}
              className={clsx(
                'rounded-xl border p-4 text-left transition-all',
                level === targetLevel ? accentUi.tabActive : 'border-bg-border bg-bg-card hover:bg-bg-elevated/40',
              )}
            >
              <p className={clsx('text-xs font-mono uppercase tracking-wider', accentUi.text)}>{t(`roadmap.${LEVEL_KEY[targetLevel]}`)}</p>
              <p className="text-[10px] font-mono text-ink-dim mt-0.5">{t(`roadmap.${LEVEL_SUB_KEY[targetLevel]}`)}</p>
              <p className="text-sm font-mono font-bold text-ink-primary mt-1.5">{route?.title ?? 'Loading...'}</p>
              <p className="text-[10px] font-mono text-ink-dim mt-2">
                Progreso: {status?.completionPct ?? 0}% · {status?.completedBlocks ?? 0}/{status?.totalBlocks ?? route?.blocks.length ?? 0}
              </p>
              <p className={`text-[10px] font-mono mt-1 ${status?.certified ? 'text-atlas' : 'text-ink-dim'}`}>
                {status?.certified ? `Certificado (${status.badge?.badgeCode ?? 'emitido'})` : 'Sin certificación'}
              </p>
            </button>
          )
        })}
      </div>

      {loading && (
        <div className="rounded-xl border border-bg-border bg-bg-card p-5 text-xs font-mono text-ink-dim">
          Cargando tu sendero de aprendizaje...
        </div>
      )}

      {!loading && visibleRoutes.map((route) => {
        const accent = ROUTE_ACCENT[route.level]
        const accentUi = ACCENT_UI[accent]
        return (
          <div key={route.id} className="rounded-xl border border-bg-border bg-bg-card p-5 space-y-6">
            <div>
              <h2 className="text-lg font-mono font-bold text-ink-primary">{route.title}</h2>
              <p className="text-xs font-mono text-ink-muted mt-1">{route.summary}</p>
              <p className="text-xs font-mono text-ink-secondary mt-3">Objetivo: {route.objective}</p>
              <p className="text-[10px] font-mono text-ink-dim mt-1">Duración estimada: {route.estimatedHours}h · Requisitos: {route.prerequisites.join(', ')}</p>
            </div>

            <div className="space-y-10">
              {route.blocks.map((block, blockIndex) => {
                const unlocked = isBlockUnlocked(route, blockIndex)
                const nodes = buildBlockNodes(route, block, unlocked)
                return (
                  <div key={block.id} className="space-y-4">
                    <div className={clsx(
                      'rounded-xl border px-4 py-3 flex items-center justify-between gap-3',
                      unlocked ? accentUi.bannerActive : 'border-bg-border bg-bg-elevated/20 opacity-70',
                    )}>
                      <div>
                        <p className={clsx('text-[9px] font-mono uppercase tracking-widest', unlocked ? accentUi.text : 'text-ink-dim')}>
                          Unidad {blockIndex + 1}
                        </p>
                        <p className="text-sm font-mono font-bold text-ink-primary mt-0.5">{block.title}</p>
                        <p className="text-[10px] font-mono text-ink-dim mt-0.5 max-w-sm">{block.objective}</p>
                      </div>
                      {!unlocked && (
                        <span className="text-[9px] font-mono text-ink-dim uppercase tracking-wider shrink-0">Aprueba la unidad anterior</span>
                      )}
                    </div>

                    <LearningPath nodes={nodes} accent={accent} />
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      <div className="rounded-xl border border-bg-border bg-bg-card p-5 space-y-4">
        <h3 className="text-sm font-mono font-bold text-ink-primary uppercase">Badges verificables</h3>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-3">
          <input
            type="text"
            value={verifyCode}
            onChange={(event) => setVerifyCode(event.target.value)}
            placeholder="QTA-BEGINNER-XXXXXX"
            className="bg-bg-deep border border-bg-border rounded-lg px-4 py-2.5 text-xs font-mono text-ink-primary focus:outline-none focus:border-oracle/50"
          />
          <button
            onClick={verifyBadge}
            className="px-4 py-2.5 rounded-lg border border-oracle/30 bg-oracle/10 text-oracle text-xs font-mono uppercase tracking-wider hover:bg-oracle/20"
          >
            Verificar badge
          </button>
        </div>
        {verifyResult && (
          <p className={`text-xs font-mono ${verifyResult.valid ? 'text-atlas' : 'text-bear'}`}>
            {verifyResult.valid ? `Badge válido (${verifyResult.routeTitle ?? 'Ruta certificada'})` : 'Badge inválido o no encontrado'}
          </p>
        )}

        <div className="space-y-2">
          {badges.length === 0 && <p className="text-xs font-mono text-ink-dim">Aún no hay badges emitidos para este learner.</p>}
          {badges.map((badge) => (
            <div key={badge.id} className="rounded-lg border border-bg-border bg-bg-elevated/20 px-3 py-2 flex items-center justify-between">
              <span className="text-xs font-mono text-ink-secondary">{badge.routeTitle}</span>
              <span className="text-[10px] font-mono text-atlas">{badge.badgeCode}</span>
            </div>
          ))}
        </div>
      </div>

      {activeLesson && (
        <LessonModal
          lesson={activeLesson.lessons[activeLesson.index]}
          index={activeLesson.index}
          total={activeLesson.lessons.length}
          onComplete={completeActiveLesson}
          onClose={() => setActiveLesson(null)}
        />
      )}

      {activeExamRoute && activeExamBlock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-bg-deep/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-xl rounded-2xl border border-bg-border bg-bg-card glass-card p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-mono text-ink-dim uppercase tracking-widest">Examen · {activeExamBlock.title}</p>
                <h2 className="text-base font-mono font-bold text-ink-primary mt-0.5">Mínimo para aprobar: {activeExamBlock.exam.passScore}</h2>
              </div>
              <button type="button" onClick={() => setActiveExamKey(null)} aria-label="Cerrar" className="text-ink-dim hover:text-ink-primary transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-3">
              {activeExamBlock.exam.questions.map((question) => (
                <div key={question.id} className="rounded-lg border border-bg-border bg-bg-elevated/20 p-3 space-y-2">
                  <p className="text-xs font-mono text-ink-primary">{question.prompt}</p>
                  <div className="grid grid-cols-1 gap-2">
                    {question.options.map((option, optionIndex) => {
                      const answerKey = `${activeExamRoute.id}:${activeExamBlock.id}:${question.id}`
                      const selected = answers[answerKey] === optionIndex
                      return (
                        <button
                          key={`${question.id}-${option}`}
                          onClick={() => setAnswer(activeExamRoute.id, activeExamBlock.id, question.id, optionIndex)}
                          className={`text-xs font-mono px-3 py-2 rounded border text-left ${selected ? 'border-oracle/40 bg-oracle/10 text-oracle' : 'border-bg-border bg-bg-card text-ink-secondary hover:bg-bg-elevated/40'}`}
                        >
                          {option}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            {(() => {
              const key = `${activeExamRoute.id}:${activeExamBlock.id}`
              const feedback = examFeedback[key]
              const blockProgress = progressMap.get(key)
              return (
                <>
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => submitExam(activeExamRoute.id, activeExamBlock.id, activeExamBlock.exam.questions.map((q) => q.id))}
                      disabled={submitting === key}
                      className="px-4 py-2 rounded border border-oracle/30 bg-oracle/10 text-oracle text-[10px] font-mono uppercase tracking-wider hover:bg-oracle/20 disabled:opacity-60"
                    >
                      {submitting === key ? 'Evaluando...' : 'Rendir examen'}
                    </button>
                    <span className="text-[10px] font-mono text-ink-dim">Mejor score: {blockProgress?.bestScore ?? '--'}</span>
                  </div>

                  {feedback && (
                    <div className={`rounded-lg border px-3 py-2 ${feedback.passed ? 'border-atlas/30 bg-atlas/10' : 'border-bear/30 bg-bear/10'}`}>
                      <p className={`text-xs font-mono font-bold ${feedback.passed ? 'text-atlas' : 'text-bear'}`}>
                        {feedback.passed ? 'Aprobado' : 'No aprobado'} · Score {feedback.score}/{feedback.passScore}
                      </p>
                      <div className="mt-2 space-y-1">
                        {feedback.answers.map((answer) => (
                          <p key={answer.questionId} className="text-[10px] font-mono text-ink-secondary">
                            {answer.isCorrect ? '✓' : '•'} {answer.explanation}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )
            })()}
          </div>
        </div>
      )}
    </div>
  )
}
