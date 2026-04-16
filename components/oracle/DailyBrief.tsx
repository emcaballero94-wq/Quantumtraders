'use client'

import { clsx } from 'clsx'
import type { DailyBrief as DailyBriefType } from '@/lib/oracle/types'
import { BiasBadge, SessionBadge } from '@/components/ui/StatusBadge'
import { useState, useEffect } from 'react'

export function DailyBrief() {
  const [brief, setBrief] = useState<DailyBriefType | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchBrief = async () => {
      try {
        const res = await fetch('/api/oracle/brief')
        const data = await res.json()
        setBrief(data)
      } catch (e) {
        console.error('Failed to load live brief')
      } finally {
        setLoading(false)
      }
    }
    fetchBrief()
  }, [])

  if (loading || !brief) {
    return <div className="p-5 text-ink-muted font-mono text-sm">Cargando Oracle...</div>
  }

  const sentimentColor = brief.sentiment === 'risk-on'  ? 'text-atlas'
                       : brief.sentiment === 'risk-off' ? 'text-bear'
                       :                                  'text-pulse'

  const sentimentLabel = brief.sentiment === 'risk-on'  ? 'RISK-ON'
                       : brief.sentiment === 'risk-off' ? 'RISK-OFF'
                       :                                  'MIXED'

  const dateFormatted = new Date(brief.date).toLocaleDateString('es-ES', {
    weekday: 'long',
    year:    'numeric',
    month:   'long',
    day:     'numeric',
    timeZone: 'UTC',
  })

  return (
    <div className="relative overflow-hidden rounded-xl border border-bg-border bg-bg-card">

      {/* Ambient gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-oracle/5 via-transparent to-transparent pointer-events-none" />

      <div className="relative p-5 space-y-5">

        {/* Header row */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xs font-mono text-ink-dim tracking-[0.2em] uppercase">
                Oracle Daily Brief
              </span>
              <span className="text-2xs font-mono text-ink-dim">·</span>
              <span className="text-2xs font-mono text-ink-dim capitalize">{dateFormatted}</span>
            </div>
            <h1 className="text-xl font-mono font-bold text-ink-primary tracking-tight">
              Centro de Decisión Diaria
            </h1>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button 
              onClick={() => {
                const utterance = new SpeechSynthesisUtterance(brief.summary);
                utterance.lang = 'es-ES';
                window.speechSynthesis.speak(utterance);
              }}
              className="flex items-center gap-2 px-3 py-1.5 bg-oracle/10 border border-oracle/30 rounded-lg text-oracle hover:bg-oracle/20 transition-all group"
              title="Escuchar Resumen (ElevenLabs Ready)"
            >
              <svg className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              </svg>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider">Escuchar</span>
            </button>
            <div className={clsx(
              'px-2 py-1 rounded border text-2xs font-mono font-semibold tracking-wider',
              brief.sentiment === 'risk-on'
                ? 'bg-atlas/10 border-atlas/30 text-atlas'
                : brief.sentiment === 'risk-off'
                ? 'bg-bear/10 border-bear/30 text-bear'
                : 'bg-pulse/10 border-pulse/30 text-pulse',
            )}>
              {sentimentLabel}
            </div>
            <BiasBadge bias={brief.marketBias} />
          </div>
        </div>

        {/* Summary */}
        <p className="text-sm text-ink-secondary leading-relaxed border-l-2 border-oracle/40 pl-4">
          {brief.summary}
        </p>

        {/* Key facts grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">

          <BriefCard
            label="Sesgo de Mercado"
            value={brief.marketBias === 'long' ? 'Alcista' : brief.marketBias === 'short' ? 'Bajista' : 'Neutral'}
            valueColor={brief.marketBias === 'long' ? 'text-atlas' : brief.marketBias === 'short' ? 'text-bear' : 'text-ink-secondary'}
          />

          <BriefCard
            label="Top Setup"
            value={brief.topSetup}
            valueColor="text-ink-primary"
            small
          />

          <BriefCard
            label="Evento Clave"
            value={brief.keyEvent}
            valueColor="text-pulse"
            small
          />

          <div className="flex flex-col gap-1.5 px-3 py-2.5 bg-bg-elevated rounded-lg border border-bg-border">
            <span className="text-2xs font-mono text-ink-muted uppercase tracking-wider">Sesión Activa</span>
            <SessionBadge
              name={brief.activeSession}
              isActive
              killZone={brief.conditions.includes('Kill Zone')}
            />
            <span className="text-2xs font-mono text-ink-muted mt-0.5">{brief.conditions}</span>
          </div>

        </div>

      </div>
    </div>
  )
}

// ─── Brief Card ──────────────────────────────────────────────

interface BriefCardProps {
  label:       string
  value:       string
  valueColor?: string
  small?:      boolean
}

function BriefCard({ label, value, valueColor = 'text-ink-primary', small }: BriefCardProps) {
  return (
    <div className="flex flex-col gap-1.5 px-3 py-2.5 bg-bg-elevated rounded-lg border border-bg-border">
      <span className="text-2xs font-mono text-ink-muted uppercase tracking-wider">{label}</span>
      <span className={clsx(
        'font-mono font-semibold leading-snug',
        small ? 'text-xs' : 'text-sm',
        valueColor,
      )}>
        {value}
      </span>
    </div>
  )
}
