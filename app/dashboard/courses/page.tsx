'use client'

import { useEffect, useMemo, useState } from 'react'
import { clsx } from 'clsx'
import { listPublicAcademyRoutes, type PublicAcademyRoute } from '@/lib/academy/content'

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

type ExamResponse = {
  success: boolean
  data?: {
    learnerId: string
    evaluation: ExamEvaluation
  }
}

type Level = 'beginner' | 'intermediate' | 'advanced' | 'edge'
type LearningMode = 'course' | 'guide' | 'hybrid'
type EdgeProfile = 'critical' | 'disordered' | 'building'
type ModuleStatus = 'INTEGRADO' | 'ACTIVO' | 'EN PROGRESO' | 'NUEVO' | 'PROXIMO'

const LEVEL_ORDER: Level[] = ['beginner', 'intermediate', 'advanced', 'edge']

const LEVEL_META: Record<Level, { label: string; mentor: string; focus: string; quickActions: string[] }> = {
  beginner: {
    label: 'BEGINNER',
    mentor: 'ATLAS',
    focus: 'Lectura de mercado',
    quickActions: ['Explicamelo simple', 'Mini prueba', 'Ejemplo real'],
  },
  intermediate: {
    label: 'INTERMEDIATE',
    mentor: 'ANALYST',
    focus: 'Confluencias',
    quickActions: ['Checklist setup', 'Confluencia macro', 'Debug de trade'],
  },
  advanced: {
    label: 'ADVANCED',
    mentor: 'QUANT',
    focus: 'Playbooks y edge',
    quickActions: ['Validar edge', 'Stress test', 'Checklist ejecucion'],
  },
  edge: {
    label: 'EDGE',
    mentor: 'EDGE',
    focus: 'Riesgo, psicologia y plan',
    quickActions: ['Bloquear revenge', 'Regla de pausa', 'Plan semanal'],
  },
}

const EDGE_DIAGNOSTIC = [
  { id: 'q1', label: 'Has operado con dinero real antes? Cual fue el resultado?' },
  { id: 'q2', label: 'Tienes estrategia definida o operas discrecional?' },
  { id: 'q3', label: 'Llevas journal o registro de operaciones?' },
  { id: 'q4', label: 'Has quemado una cuenta o sufrido drawdown grave?' },
  { id: 'q5', label: 'Cual es hoy tu mayor problema como trader?' },
] as const

const EDGE_FRAME_STEPS = [
  '1) Realidad del mercado',
  '2) Definicion practica',
  '3) Error tipico',
  '4) Regla concreta',
  '5) Ejercicio inmediato',
  '6) Checkpoint',
]

function getOrCreateLearnerId(): string {
  if (typeof window === 'undefined') return 'guest-web'
  const storageKey = 'qt_learner_id'
  const existing = localStorage.getItem(storageKey)
  if (existing) return existing
  const generated = `learner-${crypto.randomUUID().slice(0, 12)}`
  localStorage.setItem(storageKey, generated)
  return generated
}

function estimateDurationMinutes(lessonsCount: number, index: number): number {
  return lessonsCount * 7 + 14 + (index % 3) * 4
}

function moduleStatusClass(status: ModuleStatus): string {
  if (status === 'INTEGRADO') return 'text-atlas border-atlas/30 bg-atlas/10'
  if (status === 'ACTIVO') return 'text-oracle border-oracle/30 bg-oracle/10'
  if (status === 'EN PROGRESO') return 'text-pulse border-pulse/30 bg-pulse/10'
  if (status === 'PROXIMO') return 'text-ink-muted border-bg-border bg-bg-elevated/50'
  return 'text-nexus border-nexus/30 bg-nexus/10'
}

function getModuleStatus(input: {
  routeId: string
  blockId: string
  index: number
  selectedBlockId: string | null
  progressMap: Map<string, AcademyProgress>
  completionPct: number
}): ModuleStatus {
  const progress = input.progressMap.get(`${input.routeId}:${input.blockId}`)
  if (progress?.passed) return 'INTEGRADO'
  if (input.blockId === input.selectedBlockId) return 'ACTIVO'
  if (input.index === 0) return 'ACTIVO'
  if (input.completionPct > 0 && input.index <= 2) return 'EN PROGRESO'
  if (input.index === 5) return 'PROXIMO'
  return 'NUEVO'
}

function hasAnyToken(value: string, tokens: string[]): boolean {
  const normalized = value.toLowerCase()
  return tokens.some((token) => normalized.includes(token))
}

function deriveEdgeProfile(answers: Record<string, string>): EdgeProfile | null {
  const hasAllAnswers = EDGE_DIAGNOSTIC.every((item) => answers[item.id]?.trim())
  if (!hasAllAnswers) return null

  const accountDamage = answers.q4 ?? ''
  const mainProblem = answers.q5 ?? ''
  const strategy = answers.q2 ?? ''
  const journal = answers.q3 ?? ''

  const criticalSignals = hasAnyToken(accountDamage, ['si', 'sí', 'quem', 'grave', '40%', '50%']) ||
    hasAnyToken(mainProblem, ['revenge', 'fomo', 'ansiedad', 'sobreapalanc', 'perdi todo'])
  if (criticalSignals) return 'critical'

  const disorderedSignals = hasAnyToken(strategy, ['discrecional', 'no', 'sin']) ||
    hasAnyToken(journal, ['no', 'nunca', 'a veces'])
  if (disorderedSignals) return 'disordered'

  return 'building'
}

function getEdgeProfileMeta(profile: EdgeProfile | null): {
  title: string
  detail: string
  className: string
} | null {
  if (!profile) return null
  if (profile === 'critical') {
    return {
      title: 'Perfil critico',
      detail: 'Prioridad inmediata: Bloque 7 (FOMO/Revenge) + Bloque 1 (Riesgo base).',
      className: 'border-bear/30 bg-bear/10 text-bear',
    }
  }
  if (profile === 'disordered') {
    return {
      title: 'Perfil desordenado',
      detail: 'Ruta sugerida: Bloque 9 (Plan) + Bloque 3 (Position sizing).',
      className: 'border-oracle/30 bg-oracle/10 text-oracle',
    }
  }
  return {
    title: 'Perfil en construccion',
    detail: 'Ruta completa recomendada: Bloques 1 al 12 con checkpoints semanales.',
    className: 'border-atlas/30 bg-atlas/10 text-atlas',
  }
}

export default function CoursesPage() {
  const [learnerId, setLearnerId] = useState('')
  const [routes] = useState<PublicAcademyRoute[]>(() => listPublicAcademyRoutes())
  const [progress, setProgress] = useState<AcademyProgress[]>([])
  const [routeStatus, setRouteStatus] = useState<RouteStatus[]>([])
  const [badges, setBadges] = useState<AcademyBadge[]>([])
  const [level, setLevel] = useState<Level>('beginner')
  const [learningMode, setLearningMode] = useState<LearningMode>('hybrid')
  const [edgeAnswers, setEdgeAnswers] = useState<Record<string, string>>({})
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [submitting, setSubmitting] = useState<string | null>(null)
  const [examFeedback, setExamFeedback] = useState<Record<string, ExamEvaluation>>({})
  const [verifyCode, setVerifyCode] = useState('')
  const [verifyResult, setVerifyResult] = useState<{ valid: boolean; routeTitle?: string } | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = async (id: string) => {
    const progressRes = await fetch(`/api/academy/progress?learnerId=${encodeURIComponent(id)}`)
    const progressPayload = await progressRes.json()
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

  const routeStatusMap = useMemo(
    () => new Map(routeStatus.map((status) => [status.routeId, status])),
    [routeStatus],
  )
  const progressMap = useMemo(
    () => new Map(progress.map((row) => [`${row.routeId}:${row.blockId}`, row])),
    [progress],
  )
  const activeRoute = useMemo(() => routes.find((route) => route.level === level) ?? null, [routes, level])
  const activeRouteStatus = activeRoute ? routeStatusMap.get(activeRoute.id) : null
  const levelMeta = LEVEL_META[level]
  const edgeProfile = useMemo(() => (level === 'edge' ? deriveEdgeProfile(edgeAnswers) : null), [level, edgeAnswers])
  const edgeProfileMeta = getEdgeProfileMeta(edgeProfile)

  useEffect(() => {
    setLearningMode(level === 'edge' ? 'hybrid' : 'course')
  }, [level])

  useEffect(() => {
    if (!activeRoute) {
      setSelectedBlockId(null)
      return
    }
    if (selectedBlockId && activeRoute.blocks.some((block) => block.id === selectedBlockId)) return
    setSelectedBlockId(activeRoute.blocks[0]?.id ?? null)
  }, [activeRoute, selectedBlockId])

  const activeBlock = useMemo(() => {
    if (!activeRoute || !selectedBlockId) return null
    return activeRoute.blocks.find((block) => block.id === selectedBlockId) ?? null
  }, [activeRoute, selectedBlockId])

  const activeBlockProgress = useMemo(() => {
    if (!activeRoute || !activeBlock) return null
    return progressMap.get(`${activeRoute.id}:${activeBlock.id}`) ?? null
  }, [activeRoute, activeBlock, progressMap])

  const submitExam = async (routeId: string, blockId: string, questionIds: string[]) => {
    if (!learnerId) return

    const payloadAnswers = questionIds.map((questionId) => {
      const key = `${routeId}:${blockId}:${questionId}`
      return Number.isInteger(answers[key]) ? answers[key] : null
    })

    const submitKey = `${routeId}:${blockId}`
    setSubmitting(submitKey)
    try {
      const response = await fetch('/api/academy/exam', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ learnerId, routeId, blockId, answers: payloadAnswers }),
      })
      const payload = (await response.json()) as ExamResponse
      if (payload.success && payload.data?.evaluation) {
        setExamFeedback((prev) => ({ ...prev, [submitKey]: payload.data!.evaluation }))
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

  const routeContextLabel = level === 'edge'
    ? 'Sistema > EDGE > Disciplina operativa'
    : `Sistema > ${levelMeta.mentor} > ${levelMeta.focus}`
  const feedbackKey = activeRoute && activeBlock ? `${activeRoute.id}:${activeBlock.id}` : ''
  const feedback = feedbackKey ? examFeedback[feedbackKey] : undefined

  return (
    <div className="space-y-5 animate-fade-in pb-20">
      <div className="rounded-xl border border-bg-border bg-bg-card p-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <h1 className="text-xl font-mono font-bold text-ink-primary tracking-tight uppercase">Academia Quantum</h1>
            <p className="text-xs font-mono text-ink-muted mt-1">Ruta estructurada + guia personalizada + certificacion</p>
          </div>
          <span className="text-[10px] font-mono text-ink-dim uppercase">Learner ID: {learnerId || '--'}</span>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 mt-4">
          {LEVEL_ORDER.map((targetLevel) => {
            const route = routes.find((item) => item.level === targetLevel)
            const status = route ? routeStatusMap.get(route.id) : null
            const available = Boolean(route)
            return (
              <button
                key={targetLevel}
                onClick={() => available && setLevel(targetLevel)}
                disabled={!available}
                className={clsx(
                  'rounded-lg border p-3 text-left transition-all',
                  level === targetLevel
                    ? 'border-oracle/40 bg-oracle/10'
                    : 'border-bg-border bg-bg-elevated/20 hover:bg-bg-elevated/40',
                  !available && 'opacity-50 cursor-not-allowed',
                )}
              >
                <p className="text-[10px] font-mono text-ink-dim uppercase">{LEVEL_META[targetLevel].label}</p>
                <p className="text-sm font-mono font-bold text-ink-primary mt-1">{route?.title ?? 'Ruta pendiente'}</p>
                <p className="text-[10px] font-mono text-ink-muted mt-2">
                  {status?.completionPct ?? 0}% · {status?.completedBlocks ?? 0}/{status?.totalBlocks ?? route?.blocks.length ?? 0}
                </p>
              </button>
            )
          })}
        </div>
      </div>

      {loading && (
        <div className="rounded-xl border border-bg-border bg-bg-card p-5 text-xs font-mono text-ink-dim">
          Sincronizando progreso en vivo...
        </div>
      )}

      {activeRoute && (
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 xl:col-span-9 space-y-4">
            <div className="rounded-xl border border-bg-border bg-bg-card p-4">
              <p className="text-[10px] font-mono text-ink-dim uppercase tracking-[0.18em]">{routeContextLabel}</p>
              <h2 className="text-lg font-mono font-bold text-ink-primary mt-2">{activeRoute.title}</h2>
              <p className="text-xs font-mono text-ink-muted mt-1">{activeRoute.summary}</p>
              <div className="mt-4">
                <div className="h-2 rounded-full bg-bg-elevated overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-atlas to-oracle"
                    style={{ width: `${activeRouteStatus?.completionPct ?? 0}%` }}
                  />
                </div>
                <p className="text-[10px] font-mono text-ink-dim mt-2">
                  Progreso: {activeRouteStatus?.completedBlocks ?? 0}/{activeRouteStatus?.totalBlocks ?? activeRoute.blocks.length} bloques
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-bg-border bg-bg-card p-4">
              <p className="text-[10px] font-mono text-ink-dim uppercase tracking-[0.18em] mb-3">Modulos disponibles</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {activeRoute.blocks.map((block, index) => {
                  const status = getModuleStatus({
                    routeId: activeRoute.id,
                    blockId: block.id,
                    index,
                    selectedBlockId,
                    progressMap,
                    completionPct: activeRouteStatus?.completionPct ?? 0,
                  })
                  const durationMinutes = block.durationMinutes ?? estimateDurationMinutes(block.lessons.length, index)
                  const resources = block.resources?.join(' · ') ?? ''
                  const difficultyLabel = block.difficulty ? block.difficulty.toUpperCase() : 'BASE'
                  return (
                    <button
                      key={block.id}
                      onClick={() => setSelectedBlockId(block.id)}
                      className={clsx(
                        'rounded-xl border p-4 text-left transition-all bg-bg-elevated/20 hover:bg-bg-elevated/40',
                        selectedBlockId === block.id ? 'border-oracle/40 shadow-glow-oracle' : 'border-bg-border',
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-mono text-ink-dim uppercase">Modulo {index + 1}</span>
                        <span className={clsx('text-[9px] font-mono uppercase px-2 py-0.5 rounded border', moduleStatusClass(status))}>{status}</span>
                      </div>
                      <p className="text-lg font-mono font-semibold text-ink-primary mt-2">{block.title}</p>
                      <p className="text-xs font-mono text-ink-muted mt-2 leading-relaxed">{block.objective}</p>
                      <div className="mt-3 flex items-center justify-between gap-2 text-[10px] font-mono">
                        <span className="text-ink-dim">{block.lessons.length} lecciones · {durationMinutes} min</span>
                        <span className="rounded border border-bg-border px-2 py-0.5 text-ink-muted">{difficultyLabel}</span>
                      </div>
                      {resources && (
                        <p className="text-[10px] font-mono text-ink-dim mt-2 line-clamp-2">
                          Recursos: {resources}
                        </p>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {activeBlock && (
              <div className="rounded-xl border border-bg-border bg-bg-card p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-mono text-ink-dim uppercase tracking-[0.18em]">Mini checkpoint</p>
                  <p className="text-[10px] font-mono text-ink-dim">Minimo {activeBlock.exam.passScore}</p>
                </div>
                <h3 className="text-sm font-mono font-bold text-ink-primary">{activeBlock.title}</h3>
                {activeBlock.exam.questions.map((question) => (
                  <div key={question.id} className="rounded-lg border border-bg-border bg-bg-elevated/20 p-3">
                    <p className="text-xs font-mono text-ink-secondary">{question.prompt}</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3">
                      {question.options.map((option, optionIndex) => {
                        const key = `${activeRoute.id}:${activeBlock.id}:${question.id}`
                        const selected = answers[key] === optionIndex
                        return (
                          <button
                            key={`${question.id}-${option}`}
                            onClick={() => setAnswers((prev) => ({ ...prev, [key]: optionIndex }))}
                            className={clsx(
                              'text-xs font-mono px-3 py-2 rounded border text-left transition-colors',
                              selected
                                ? 'border-oracle/40 bg-oracle/10 text-oracle'
                                : 'border-bg-border bg-bg-card text-ink-muted hover:bg-bg-elevated/40',
                            )}
                          >
                            {option}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => submitExam(activeRoute.id, activeBlock.id, activeBlock.exam.questions.map((question) => question.id))}
                    disabled={submitting === feedbackKey}
                    className="px-4 py-2 rounded border border-oracle/30 bg-oracle/10 text-oracle text-[10px] font-mono uppercase tracking-wider hover:bg-oracle/20 disabled:opacity-60"
                  >
                    {submitting === feedbackKey ? 'Evaluando...' : 'Rendir examen'}
                  </button>
                  <span className="text-[10px] font-mono text-ink-dim">Mejor score: {activeBlockProgress?.bestScore ?? '--'}</span>
                </div>
              </div>
            )}
          </div>

          <div className="col-span-12 xl:col-span-3">
            <div className="sticky top-16 rounded-xl border border-bg-border bg-bg-card overflow-hidden">
              <div className={clsx(
                'px-4 py-3 border-b border-bg-border',
                level === 'edge' ? 'bg-bear/10' : 'bg-oracle/10',
              )}>
                <p className={clsx(
                  'text-sm font-mono font-bold',
                  level === 'edge' ? 'text-bear' : 'text-oracle',
                )}>
                  {levelMeta.mentor} en sesion
                </p>
                <p className="text-[10px] font-mono text-ink-muted mt-1">
                  {activeBlock ? activeBlock.title : 'Selecciona un modulo'}
                </p>
              </div>
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { key: 'course', label: 'Curso' },
                    { key: 'guide', label: 'Guia' },
                    { key: 'hybrid', label: 'Hibrido' },
                  ] as const).map((mode) => (
                    <button
                      key={mode.key}
                      onClick={() => setLearningMode(mode.key)}
                      className={clsx(
                        'text-[10px] font-mono uppercase px-2 py-1.5 rounded border transition-colors',
                        learningMode === mode.key
                          ? 'border-oracle/40 bg-oracle/10 text-oracle'
                          : 'border-bg-border bg-bg-elevated/20 text-ink-muted hover:bg-bg-elevated/40',
                      )}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>

                <p className="text-xs font-mono text-ink-secondary leading-relaxed">
                  Modo {learningMode === 'course' ? 'curso' : learningMode === 'guide' ? 'guia personalizada' : 'hibrido'} activo.
                  {' '}Este track mezcla contenido estructurado con acompanamiento contextual.
                </p>

                <div className="rounded-lg border border-bg-border bg-bg-elevated/30 p-3">
                  <p className="text-xs font-mono text-ink-primary font-semibold">Hola. Soy {levelMeta.mentor}.</p>
                  <p className="text-xs font-mono text-ink-secondary mt-2">Objetivo ahora: {levelMeta.focus}.</p>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  {levelMeta.quickActions.map((item) => (
                    <button
                      key={item}
                      className="text-[10px] font-mono uppercase px-3 py-2 rounded border border-bg-border bg-bg-elevated/20 hover:bg-bg-elevated/40 text-ink-secondary"
                    >
                      {item}
                    </button>
                  ))}
                </div>

                {learningMode !== 'course' && (
                  <div className="rounded-lg border border-bg-border bg-bg-elevated/20 p-3">
                    <p className="text-[10px] font-mono text-ink-dim uppercase mb-2">Marco de coaching</p>
                    <div className="space-y-1">
                      {EDGE_FRAME_STEPS.map((step) => (
                        <p key={step} className="text-[10px] font-mono text-ink-muted">{step}</p>
                      ))}
                    </div>
                  </div>
                )}

                {level === 'edge' && learningMode !== 'course' && (
                  <div className="rounded-lg border border-bear/20 bg-bear/5 p-3 space-y-2">
                    <p className="text-[10px] font-mono text-bear uppercase">Diagnostico inicial EDGE</p>
                    {EDGE_DIAGNOSTIC.map((item) => (
                      <div key={item.id} className="space-y-1">
                        <p className="text-[10px] font-mono text-ink-muted">{item.label}</p>
                        <textarea
                          value={edgeAnswers[item.id] ?? ''}
                          onChange={(event) => setEdgeAnswers((prev) => ({ ...prev, [item.id]: event.target.value }))}
                          rows={2}
                          className="w-full bg-bg-deep border border-bg-border rounded px-2 py-1.5 text-[10px] font-mono text-ink-primary focus:outline-none focus:border-oracle/40 resize-none"
                        />
                      </div>
                    ))}
                    {edgeProfileMeta && (
                      <div className={clsx('rounded border px-2 py-2', edgeProfileMeta.className)}>
                        <p className="text-[10px] font-mono font-semibold uppercase">{edgeProfileMeta.title}</p>
                        <p className="text-[10px] font-mono mt-1 text-ink-secondary">{edgeProfileMeta.detail}</p>
                      </div>
                    )}
                    <p className="text-[10px] font-mono text-ink-dim">
                      Si necesitas ICT/SMC/Wyckoff profundo, usa ANALYST. Para validacion cuantitativa, usa QUANT.
                    </p>
                  </div>
                )}

                {learningMode !== 'guide' && activeBlock && (
                  <div className="rounded-lg border border-bg-border bg-bg-elevated/20 p-3 space-y-2">
                    <p className="text-[10px] font-mono text-ink-dim uppercase">Plan de estudio del bloque</p>
                    {activeBlock.lessons.map((lesson) => (
                      <p key={lesson} className="text-[10px] font-mono text-ink-muted">• {lesson}</p>
                    ))}
                  </div>
                )}

                {feedback && (
                  <div className={clsx(
                    'rounded-lg border px-3 py-2',
                    feedback.passed ? 'border-atlas/30 bg-atlas/10' : 'border-bear/30 bg-bear/10',
                  )}>
                    <p className={clsx('text-xs font-mono font-bold', feedback.passed ? 'text-atlas' : 'text-bear')}>
                      {feedback.passed ? 'Aprobado' : 'No aprobado'} · {feedback.score}/{feedback.passScore}
                    </p>
                    <p className="text-[10px] font-mono text-ink-muted mt-1">
                      Revisa explicaciones y repite el checkpoint si hace falta.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-bg-border bg-bg-card p-5 space-y-4">
        <h3 className="text-sm font-mono font-bold text-ink-primary uppercase">Badge verificable</h3>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-3">
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
            Verificar
          </button>
        </div>
        {verifyResult && (
          <p className={clsx('text-xs font-mono', verifyResult.valid ? 'text-atlas' : 'text-bear')}>
            {verifyResult.valid ? `Badge valido (${verifyResult.routeTitle ?? 'Ruta certificada'})` : 'Badge invalido o no encontrado'}
          </p>
        )}
        <div className="space-y-2">
          {badges.length === 0 && (
            <p className="text-xs font-mono text-ink-dim">Aun no hay badges emitidos para este learner.</p>
          )}
          {badges.map((badge) => (
            <div key={badge.id} className="rounded-lg border border-bg-border bg-bg-elevated/20 px-3 py-2 flex items-center justify-between">
              <span className="text-xs font-mono text-ink-secondary">{badge.routeTitle}</span>
              <span className="text-[10px] font-mono text-atlas">{badge.badgeCode}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
