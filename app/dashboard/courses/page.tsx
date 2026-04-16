'use client'

import { useEffect, useMemo, useState } from 'react'
import type { PublicAcademyRoute } from '@/lib/academy/content'

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

function getOrCreateLearnerId(): string {
  if (typeof window === 'undefined') return 'guest-web'
  const storageKey = 'qt_learner_id'
  const existing = localStorage.getItem(storageKey)
  if (existing) return existing
  const generated = `learner-${crypto.randomUUID().slice(0, 12)}`
  localStorage.setItem(storageKey, generated)
  return generated
}

export default function CoursesPage() {
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

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="flex items-center justify-between border-b border-bg-border pb-4">
        <div>
          <h1 className="text-xl font-mono font-bold text-ink-primary tracking-tight uppercase">Academia Quantum</h1>
          <p className="text-xs font-mono text-ink-muted mt-1">Ruta clara de progreso + certificación verificable</p>
        </div>
        <span className="text-[10px] font-mono text-ink-dim uppercase">Learner ID: {learnerId || '--'}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {(['beginner', 'intermediate', 'advanced'] as const).map((targetLevel) => {
          const route = routes.find((item) => item.level === targetLevel)
          const status = route ? routeStatusMap.get(route.id) : null
          return (
            <button
              key={targetLevel}
              onClick={() => setLevel(targetLevel)}
              className={`rounded-xl border p-4 text-left transition-all ${level === targetLevel ? 'border-oracle/40 bg-oracle/10' : 'border-bg-border bg-bg-card hover:bg-bg-elevated/40'}`}
            >
              <p className="text-xs font-mono text-ink-muted uppercase">{targetLevel}</p>
              <p className="text-sm font-mono font-bold text-ink-primary mt-1">{route?.title ?? 'Cargando...'}</p>
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
          Cargando arquitectura de cursos...
        </div>
      )}

      {!loading && visibleRoutes.map((route) => (
        <div key={route.id} className="rounded-xl border border-bg-border bg-bg-card p-5 space-y-5">
          <div>
            <h2 className="text-lg font-mono font-bold text-ink-primary">{route.title}</h2>
            <p className="text-xs font-mono text-ink-muted mt-1">{route.summary}</p>
            <p className="text-xs font-mono text-ink-secondary mt-3">Objetivo: {route.objective}</p>
            <p className="text-[10px] font-mono text-ink-dim mt-1">Duración estimada: {route.estimatedHours}h · Requisitos: {route.prerequisites.join(', ')}</p>
          </div>

          <div className="space-y-4">
            {route.blocks.map((block) => {
              const key = `${route.id}:${block.id}`
              const feedback = examFeedback[key]
              const blockProgress = progressMap.get(key)
              return (
                <div key={block.id} className="rounded-lg border border-bg-border bg-bg-elevated/20 p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-mono font-bold text-ink-primary">{block.title}</h3>
                      <p className="text-xs font-mono text-ink-muted mt-1">{block.objective}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-[10px] font-mono ${blockProgress?.passed ? 'text-atlas' : 'text-ink-dim'}`}>
                        {blockProgress?.passed ? 'Bloque aprobado' : 'Pendiente'}
                      </p>
                      <p className="text-[10px] font-mono text-ink-dim">Intentos: {blockProgress?.attempts ?? 0}</p>
                    </div>
                  </div>

                  <ul className="space-y-1">
                    {block.lessons.map((lesson) => (
                      <li key={lesson} className="text-xs font-mono text-ink-secondary">• {lesson}</li>
                    ))}
                  </ul>

                  <div className="space-y-3">
                    <p className="text-[10px] font-mono text-ink-muted uppercase">Examen del bloque (mínimo {block.exam.passScore})</p>
                    {block.exam.questions.map((question) => (
                      <div key={question.id} className="rounded-lg border border-bg-border bg-bg-card p-3 space-y-2">
                        <p className="text-xs font-mono text-ink-primary">{question.prompt}</p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                          {question.options.map((option, optionIndex) => {
                            const answerKey = `${route.id}:${block.id}:${question.id}`
                            const selected = answers[answerKey] === optionIndex
                            return (
                              <button
                                key={`${question.id}-${option}`}
                                onClick={() => setAnswer(route.id, block.id, question.id, optionIndex)}
                                className={`text-xs font-mono px-3 py-2 rounded border text-left ${selected ? 'border-oracle/40 bg-oracle/10 text-oracle' : 'border-bg-border bg-bg-elevated/20 text-ink-secondary hover:bg-bg-elevated/40'}`}
                              >
                                {option}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => submitExam(route.id, block.id, block.exam.questions.map((question) => question.id))}
                      disabled={submitting === key}
                      className="px-4 py-2 rounded border border-oracle/30 bg-oracle/10 text-oracle text-[10px] font-mono uppercase tracking-wider hover:bg-oracle/20 disabled:opacity-60"
                    >
                      {submitting === key ? 'Evaluando...' : 'Rendir examen'}
                    </button>
                    <span className="text-[10px] font-mono text-ink-dim">
                      Mejor score: {blockProgress?.bestScore ?? '--'}
                    </span>
                  </div>

                  {feedback && (
                    <div className={`rounded-lg border px-3 py-2 ${feedback.passed ? 'border-atlas/30 bg-atlas/10' : 'border-bear/30 bg-bear/10'}`}>
                      <p className={`text-xs font-mono font-bold ${feedback.passed ? 'text-atlas' : 'text-bear'}`}>
                        {feedback.passed ? 'Aprobado' : 'No aprobado'} · Score {feedback.score}/{feedback.passScore}
                      </p>
                      <div className="mt-2 space-y-1">
                        {feedback.answers.map((answer: ExamEvaluation['answers'][number]) => (
                          <p key={answer.questionId} className="text-[10px] font-mono text-ink-secondary">
                            {answer.isCorrect ? '✓' : '•'} {answer.explanation}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}

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
    </div>
  )
}
