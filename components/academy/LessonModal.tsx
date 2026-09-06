'use client'

import type { AcademyLesson } from '@/lib/academy/content'

export function LessonModal({
  lesson,
  index,
  total,
  onComplete,
  onClose,
}: {
  lesson: AcademyLesson
  index: number
  total: number
  onComplete: () => void
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-bg-deep/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg rounded-2xl border border-bg-border bg-bg-card glass-card p-6 space-y-5 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono text-ink-dim uppercase tracking-widest">Lección {index + 1} de {total}</span>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="text-ink-dim hover:text-ink-primary transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <h2 className="text-lg font-mono font-bold text-ink-primary leading-snug">{lesson.title}</h2>
        <p className="text-sm font-mono text-ink-secondary leading-relaxed">{lesson.content}</p>

        <div className="space-y-2 border-t border-bg-border pt-4">
          <p className="text-[9px] font-mono text-ink-dim uppercase tracking-widest">Puntos clave</p>
          {lesson.keyPoints.map((point) => (
            <div key={point} className="flex gap-2 text-xs font-mono text-ink-secondary">
              <span className="text-oracle shrink-0">✓</span>
              <span>{point}</span>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={onComplete}
          className="w-full px-4 py-3 rounded-xl bg-oracle/15 text-oracle border border-oracle/30 text-xs font-mono font-bold uppercase tracking-widest hover:bg-oracle/25 transition-colors"
        >
          Continuar →
        </button>
      </div>
    </div>
  )
}
