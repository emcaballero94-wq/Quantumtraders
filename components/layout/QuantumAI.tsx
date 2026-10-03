'use client'

import { useEffect, useState } from 'react'
import { clsx } from 'clsx'
import type { AcademyLevel } from '@/lib/academy/content'
import { ManuMessageContent } from './ManuMessageContent'
import { emitManuSignal, type ManuSource } from '@/lib/quantum-city/manu-bus'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

const LEVEL_LABELS: Record<AcademyLevel, string> = {
  beginner: 'Principiante',
  intermediate: 'Intermedio',
  advanced: 'Avanzado',
}

const LEVEL_STORAGE_KEY = 'qt_mando_level'

interface QuickPrompt {
  label: string
  prompt: string
  level: AcademyLevel
}

interface QuickActionCategory {
  id: string
  label: string
  icon: string
  prompts: QuickPrompt[]
}

// Persistent category chips above the input — grouped so the panel can offer
// more than a handful of one-off buttons without cluttering the empty state.
const QUICK_ACTION_CATEGORIES: QuickActionCategory[] = [
  {
    id: 'market-analysis',
    label: 'Análisis de Mercado',
    icon: '📊',
    prompts: [
      { label: 'Analiza NASDAQ', prompt: 'Analiza NASDAQ', level: 'intermediate' },
      { label: 'Analiza el oro (XAUUSD)', prompt: 'Analiza el oro (XAUUSD)', level: 'beginner' },
      { label: 'Analiza el SP500', prompt: 'Analiza el SP500', level: 'intermediate' },
      { label: 'Analiza BTC', prompt: 'Analiza BTC', level: 'intermediate' },
    ],
  },
  {
    id: 'opportunities',
    label: 'Encontrar Oportunidades',
    icon: '💰',
    prompts: [
      {
        label: '¿Debería comprar, vender o esperar según el mercado actual?',
        prompt: 'Según las condiciones actuales del mercado, ¿debería comprar, vender o esperar?',
        level: 'beginner',
      },
      {
        label: 'Identifica posibles rupturas (breakouts) en el mercado actual',
        prompt: 'Identifica posibles oportunidades de ruptura (breakout) en el mercado actual',
        level: 'advanced',
      },
      {
        label: '¿Hay buenos setups formándose ahora mismo?',
        prompt: '¿Hay buenos setups de trading formándose ahora mismo?',
        level: 'beginner',
      },
      {
        label: '¿Cuáles son los mejores puntos de entrada para largo?',
        prompt: '¿Cuáles son los mejores puntos de entrada para una posición larga?',
        level: 'intermediate',
      },
    ],
  },
]

export function QuantumAI() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: 'M.A.N.U. ONLINE.\n\n¿Qué quieres analizar?' },
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [level, setLevel] = useState<AcademyLevel>('intermediate')
  const [openCategory, setOpenCategory] = useState<string | null>(null)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LEVEL_STORAGE_KEY)
      if (saved === 'beginner' || saved === 'intermediate' || saved === 'advanced') setLevel(saved)
    } catch {
      // Private browsing / blocked storage — just keep the default.
    }
  }, [])

  const handleLevelChange = (next: AcademyLevel) => {
    setLevel(next)
    try {
      localStorage.setItem(LEVEL_STORAGE_KEY, next)
    } catch {
      // Ignore — worst case it resets to Intermedio next visit.
    }
  }

  const handleSend = async (overrideText?: string) => {
    const text = (overrideText ?? input).trim()
    if (!text || isLoading) return

    const newMessages: ChatMessage[] = [...messages, { role: 'user', content: text }]
    setMessages(newMessages)
    setInput('')
    setIsLoading(true)
    emitManuSignal({ phase: 'thinking', question: text })

    try {
      const response = await fetch('/api/oracle/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages, level }),
      })
      const result = await response.json()

      const reply = result?.success
        ? result.data.reply
        : result?.error ?? 'No se pudo obtener respuesta del sistema M.A.N.U.'

      setMessages([...newMessages, { role: 'assistant', content: reply }])
      if (result?.success) {
        const sources: ManuSource[] = Array.isArray(result.data.sources) ? result.data.sources : []
        emitManuSignal({ phase: 'answered', question: text, sources, symbol: result.data.symbol ?? null })
      } else {
        emitManuSignal({ phase: 'failed' })
      }
    } catch {
      setMessages([...newMessages, { role: 'assistant', content: 'Error de conexión con el sistema M.A.N.U..' }])
      emitManuSignal({ phase: 'failed' })
    } finally {
      setIsLoading(false)
    }
  }

  const handleQuickPrompt = (prompt: string) => {
    setOpenCategory(null)
    handleSend(prompt)
  }

  return (
    <>
      {/* Floating Toggle */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          "fixed bottom-6 right-6 w-14 h-14 rounded-full glass border border-oracle/50 flex items-center justify-center z-50 transition-all hover:scale-105 active:scale-95 group",
          isOpen ? "rotate-90" : "rotate-0 text-oracle"
        )}
      >
        <span className="text-xl font-bold font-mono">Q</span>
        <div className="absolute inset-0 rounded-full border border-oracle/20 animate-ping opacity-20" />
      </button>

      {/* AI Panel */}
      <div
        className={clsx(
          "fixed top-0 right-0 h-screen w-full md:w-[400px] border-l border-bg-border z-40 transition-transform duration-300 ease-in-out glass-card",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="px-6 py-5 border-b border-bg-border flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded bg-oracle/10 border border-oracle/30 flex items-center justify-center">
                <span className="text-oracle text-xs font-mono font-bold">Q</span>
              </div>
              <div>
                <h3 className="text-sm font-mono font-bold text-ink-primary">M.A.N.U.</h3>
                <p className="text-2xs font-mono text-atlas flex items-center gap-1.5">
                  <span className="w-1 h-1 bg-atlas rounded-full animate-pulse" />
                  ONLINE
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-ink-muted hover:text-ink-primary transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Level selector — same vocabulary as Academy (lib/academy/content.ts), tunes how much M.A.N.U. explains before using a term. */}
          <div className="px-6 py-2.5 border-b border-bg-border flex items-center justify-between gap-3">
            <span className="text-2xs font-mono uppercase tracking-wider text-ink-dim">Nivel</span>
            <select
              value={level}
              onChange={(e) => handleLevelChange(e.target.value as AcademyLevel)}
              className="bg-bg-deep border border-bg-border rounded-md px-2.5 py-1 text-2xs font-mono text-ink-primary focus:outline-none focus:border-oracle/50 transition-colors"
            >
              {(Object.keys(LEVEL_LABELS) as AcademyLevel[]).map((lvl) => (
                <option key={lvl} value={lvl}>
                  {LEVEL_LABELS[lvl]}
                </option>
              ))}
            </select>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {messages.map((m, i) =>
              m.role === 'user' ? (
                <div key={i} className="flex flex-col items-end">
                  <div className="max-w-[85%] px-4 py-3 rounded-xl text-xs font-mono leading-relaxed bg-bg-elevated text-ink-primary border border-bg-border">
                    {m.content}
                  </div>
                </div>
              ) : (
                <div
                  key={i}
                  className="w-full px-4 py-3 rounded-lg text-xs font-mono leading-relaxed bg-oracle/5 border border-oracle/20 text-ink-secondary"
                >
                  <ManuMessageContent content={m.content} />
                </div>
              ),
            )}
            {isLoading && (
              <div className="w-full px-4 py-3 rounded-lg text-xs font-mono leading-relaxed bg-oracle/5 border border-oracle/20 text-ink-dim animate-pulse">
                Procesando...
              </div>
            )}
          </div>

          {/* Quick action categories — always available, not just on the empty state */}
          <div className="px-4 pt-3 relative border-t border-bg-border">
            <div className="flex gap-2">
              {QUICK_ACTION_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  disabled={isLoading}
                  onClick={() => setOpenCategory(openCategory === cat.id ? null : cat.id)}
                  className={clsx(
                    'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-full border text-2xs font-mono font-bold transition-colors disabled:opacity-50',
                    openCategory === cat.id
                      ? 'border-oracle/60 bg-oracle/10 text-oracle'
                      : 'border-bg-border text-ink-secondary hover:border-oracle/40 hover:text-oracle',
                  )}
                >
                  <span aria-hidden>{cat.icon}</span>
                  <span className="truncate">{cat.label}</span>
                  <svg
                    className={clsx('w-3 h-3 shrink-0 transition-transform', openCategory === cat.id && 'rotate-180')}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              ))}
            </div>

            {openCategory && (
              <div className="absolute bottom-full left-4 right-4 mb-2 rounded-xl border border-bg-border bg-bg-card shadow-xl overflow-hidden z-10">
                {QUICK_ACTION_CATEGORIES.find((cat) => cat.id === openCategory)?.prompts.map((p, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleQuickPrompt(p.prompt)}
                    className="w-full text-left px-4 py-3 border-b border-bg-border last:border-b-0 hover:bg-oracle/5 transition-colors"
                  >
                    <p className="text-xs font-mono text-ink-primary leading-snug">{p.label}</p>
                    <p className="text-2xs font-mono text-ink-dim mt-0.5 uppercase tracking-wider">{LEVEL_LABELS[p.level]}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Input */}
          <div className="p-4 border-t border-bg-border">
            <div className="relative">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Pregúntale algo a M.A.N.U..."
                disabled={isLoading}
                className="w-full bg-bg-deep border border-bg-border rounded-lg pl-4 pr-12 py-3 text-xs font-mono text-ink-primary focus:outline-none focus:border-oracle/50 transition-colors placeholder:text-ink-dim disabled:opacity-50"
              />
              <button
                onClick={() => handleSend()}
                disabled={isLoading}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-md bg-oracle/10 text-oracle flex items-center justify-center hover:bg-oracle/20 transition-colors disabled:opacity-50"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
