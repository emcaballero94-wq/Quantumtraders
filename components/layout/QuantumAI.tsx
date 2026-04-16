'use client'

import { useState } from 'react'
import { clsx } from 'clsx'

export function QuantumAI() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'SISTEMA MANDO ACTIVO. ¿Qué activo deseas analizar hoy?' }
  ])
  const [input, setInput] = useState('')

  const handleSend = () => {
    if (!input.trim()) return
    const newMessages = [...messages, { role: 'user', content: input }]
    setMessages(newMessages)
    setInput('')
    
    // Simulate AI response
    setTimeout(() => {
      setMessages([...newMessages, { 
        role: 'assistant', 
        content: 'Procesando datos de ORÁCULO... Detecto alta probabilidad en XAUUSD para la sesión de NY. Bias actual: ALCISTA.' 
      }])
    }, 1000)
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
            {messages.map((m, i) => (
              <div key={i} className={clsx("flex flex-col", m.role === 'user' ? "items-end" : "items-start")}>
                <div className={clsx(
                  "max-w-[85%] px-4 py-3 rounded-xl text-xs font-mono leading-relaxed",
                  m.role === 'user' 
                    ? "bg-bg-elevated text-ink-primary border border-bg-border" 
                    : "bg-oracle/5 border border-oracle/20 text-ink-secondary"
                )}>
                  {m.content}
                </div>
                <span className="text-[10px] font-mono text-ink-dim mt-1.5 uppercase">
                  {m.role === 'assistant' ? 'Mando System' : 'Trader'}
                </span>
              </div>
            ))}
          </div>

          {/* Input */}
          <div className="p-4 border-t border-bg-border">
            <div className="relative">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Escribe un comando o pregunta..."
                className="w-full bg-bg-deep border border-bg-border rounded-lg pl-4 pr-12 py-3 text-xs font-mono text-ink-primary focus:outline-none focus:border-oracle/50 transition-colors placeholder:text-ink-dim"
              />
              <button
                onClick={handleSend}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-md bg-oracle/10 text-oracle flex items-center justify-center hover:bg-oracle/20 transition-colors"
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
