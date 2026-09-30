'use client'

import { useState } from 'react'
import { clsx } from 'clsx'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

const QUICK_ACTIONS: { label: string; prompt: string }[] = [
  { label: 'NASDAQ', prompt: 'Analiza NASDAQ' },
  { label: 'GOLD', prompt: 'Analiza el oro (XAUUSD)' },
  { label: 'SP500', prompt: 'Analiza el SP500' },
  { label: 'BTC', prompt: 'Analiza BTC' },
  { label: 'SCAN MARKET', prompt: 'Busca oportunidades en el mercado ahora mismo' },
]

export function QuantumAI() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: 'MANDO AI ONLINE.\n\n¿Qué quieres analizar?' },
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSend = async (overrideText?: string) => {
    const text = (overrideText ?? input).trim()
    if (!text || isLoading) return

    const newMessages: ChatMessage[] = [...messages, { role: 'user', content: text }]
    setMessages(newMessages)
    setInput('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/oracle/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      })
      const result = await response.json()

      const reply = result?.success
        ? result.data.reply
        : result?.error ?? 'No se pudo obtener respuesta del sistema MANDO.'

      setMessages([...newMessages, { role: 'assistant', content: reply }])
    } catch {
      setMessages([...newMessages, { role: 'assistant', content: 'Error de conexión con el sistema MANDO.' }])
    } finally {
      setIsLoading(false)
    }
  }

  const showQuickActions = messages.length === 1 && !isLoading

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
                <h3 className="text-sm font-mono font-bold text-ink-primary">MANDO AI</h3>
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
                  className="w-full px-4 py-3 rounded-lg text-xs font-mono leading-relaxed bg-oracle/5 border border-oracle/20 text-ink-secondary whitespace-pre-wrap"
                >
                  {m.content}
                </div>
              ),
            )}
            {isLoading && (
              <div className="w-full px-4 py-3 rounded-lg text-xs font-mono leading-relaxed bg-oracle/5 border border-oracle/20 text-ink-dim animate-pulse">
                Procesando...
              </div>
            )}
            {showQuickActions && (
              <div className="flex flex-col gap-2 pt-2">
                {QUICK_ACTIONS.map((action) => (
                  <button
                    key={action.label}
                    onClick={() => handleSend(action.prompt)}
                    className="w-full px-4 py-3 rounded-lg text-xs font-mono font-bold tracking-[0.08em] text-ink-primary border border-bg-border hover:border-oracle/50 hover:bg-oracle/5 transition-colors text-left"
                  >
                    {action.label}
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
                placeholder="Pregúntale algo a MANDO..."
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
