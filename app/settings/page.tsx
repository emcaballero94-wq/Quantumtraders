'use client'

import { useEffect, useState } from 'react'

const STORAGE_KEY = 'qt-settings'

const VOICE_OPTIONS = ['Adam (Premium)', 'Antoni (Expressive)', 'Bella (Narrative)'] as const

interface Settings {
  whatsAppEnabled: boolean
  phoneNumber: string
  voice: string
  voiceSummaries: boolean
  voiceConfirm: boolean
}

const DEFAULTS: Settings = {
  whatsAppEnabled: false,
  phoneNumber: '',
  voice: VOICE_OPTIONS[0],
  voiceSummaries: true,
  voiceConfirm: true,
}

function isValidPhone(value: string): boolean {
  return /^\+\d{8,15}$/.test(value.replace(/\s/g, ''))
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>(DEFAULTS)
  const [phoneStatus, setPhoneStatus] = useState<'idle' | 'valid' | 'invalid'>('idle')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      try {
        setSettings({ ...DEFAULTS, ...JSON.parse(raw) })
      } catch {
        // ignore corrupted local storage
      }
    }
  }, [])

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const handleValidatePhone = () => {
    setPhoneStatus(isValidPhone(settings.phoneNumber) ? 'valid' : 'invalid')
  }

  return (
    <div className="max-w-[800px] mx-auto space-y-8 animate-fade-in py-10 px-6">
      <div className="border-b border-bg-border pb-6">
        <h1 className="text-2xl font-mono font-bold text-ink-primary tracking-tighter uppercase">Configuración de Sistema</h1>
        <p className="text-xs font-mono text-ink-muted mt-1 uppercase tracking-widest">Ajustes de Terminal y Alertas</p>
      </div>

      <div className="space-y-6">
        {/* WhatsApp Section */}
        <div className="rounded-xl border border-bg-border bg-bg-card p-6 glass-card space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="text-sm font-mono font-bold text-ink-primary uppercase italic">Alertas por WhatsApp</h3>
              <p className="text-xs font-mono text-ink-muted leading-tight max-w-[400px]">
                Recibe señales de ATLAS y avisos del ORÁCULO directamente en tu móvil.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.whatsAppEnabled}
              aria-label="Activar alertas por WhatsApp"
              onClick={() => update('whatsAppEnabled', !settings.whatsAppEnabled)}
              className={`w-12 h-6 rounded-full transition-all relative ${settings.whatsAppEnabled ? 'bg-atlas' : 'bg-bg-border'}`}
            >
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-ink-primary transition-all ${settings.whatsAppEnabled ? 'left-7' : 'left-1'}`} />
            </button>
          </div>

          {settings.whatsAppEnabled && (
            <div className="space-y-3 animate-slide-up">
              <label htmlFor="phone" className="text-[10px] font-mono text-ink-muted uppercase tracking-wider">
                Número de Teléfono (Formato Internacional)
              </label>
              <div className="flex gap-2">
                <input
                  id="phone"
                  type="text"
                  placeholder="+34600000000"
                  value={settings.phoneNumber}
                  onChange={(e) => { update('phoneNumber', e.target.value); setPhoneStatus('idle') }}
                  className="flex-1 bg-bg-deep border border-bg-border rounded-lg px-4 py-2.5 text-xs font-mono text-ink-primary focus:outline-none focus:border-atlas/50"
                />
                <button
                  type="button"
                  onClick={handleValidatePhone}
                  className="px-6 py-2.5 bg-atlas/10 text-atlas border border-atlas/30 rounded-lg text-[10px] font-mono font-bold hover:bg-atlas/20 transition-all uppercase tracking-widest"
                >
                  Validar
                </button>
              </div>
              {phoneStatus === 'valid' && (
                <p className="text-2xs font-mono text-atlas">Número válido.</p>
              )}
              {phoneStatus === 'invalid' && (
                <p className="text-2xs font-mono text-bear">Usa formato internacional, ej. +34600000000.</p>
              )}
            </div>
          )}
        </div>

        {/* Voice Section */}
        <div className="rounded-xl border border-bg-border bg-bg-card p-6 glass-card space-y-6">
          <h3 className="text-sm font-mono font-bold text-ink-primary uppercase italic">Interacción por Voz (MANDO AI)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div className="space-y-2">
                <label htmlFor="voice-select" className="text-[10px] font-mono text-ink-muted uppercase">Voz de Respuesta</label>
                <select
                  id="voice-select"
                  value={settings.voice}
                  onChange={(e) => update('voice', e.target.value)}
                  className="w-full bg-bg-deep border border-bg-border rounded-lg px-4 py-2.5 text-xs font-mono text-ink-primary focus:outline-none focus:border-oracle/50"
                >
                  {VOICE_OPTIONS.map((v) => <option key={v}>{v}</option>)}
                </select>
             </div>
             <div className="space-y-4 pt-6">
                <label className="flex items-center gap-3 cursor-pointer">
                   <input
                     type="checkbox"
                     checked={settings.voiceSummaries}
                     onChange={(e) => update('voiceSummaries', e.target.checked)}
                     className="w-4 h-4 rounded border-bg-border bg-bg-deep text-oracle"
                   />
                   <span className="text-[10px] font-mono text-ink-secondary uppercase">Resúmenes por voz activados</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                   <input
                     type="checkbox"
                     checked={settings.voiceConfirm}
                     onChange={(e) => update('voiceConfirm', e.target.checked)}
                     className="w-4 h-4 rounded border-bg-border bg-bg-deep text-oracle"
                   />
                   <span className="text-[10px] font-mono text-ink-secondary uppercase">Confirmar trades por voz</span>
                </label>
             </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={handleSave}
            className="px-6 py-2.5 bg-oracle/10 text-oracle border border-oracle/30 rounded-lg text-[10px] font-mono font-bold hover:bg-oracle/20 transition-all uppercase tracking-widest"
          >
            Guardar cambios
          </button>
          {saved && <span className="text-2xs font-mono text-atlas">Guardado.</span>}
        </div>
      </div>
    </div>
  )
}
