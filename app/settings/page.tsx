'use client'

import { useState } from 'react'

export default function SettingsPage() {
  const [whatsAppEnabled, setWhatsAppEnabled] = useState(false)
  const [phoneNumber, setPhoneNumber] = useState('')

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
              onClick={() => setWhatsAppEnabled(!whatsAppEnabled)}
              className={`w-12 h-6 rounded-full transition-all relative ${whatsAppEnabled ? 'bg-atlas' : 'bg-bg-border'}`}
            >
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-ink-primary transition-all ${whatsAppEnabled ? 'left-7' : 'left-1'}`} />
            </button>
          </div>

          {whatsAppEnabled && (
            <div className="space-y-3 animate-slide-up">
              <label className="text-[10px] font-mono text-ink-muted uppercase tracking-wider">Número de Teléfono (Formato Internacional)</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="+34 000 000 000"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="flex-1 bg-bg-deep border border-bg-border rounded-lg px-4 py-2.5 text-xs font-mono text-ink-primary focus:outline-none focus:border-atlas/50"
                />
                <button className="px-6 py-2.5 bg-atlas/10 text-atlas border border-atlas/30 rounded-lg text-[10px] font-mono font-bold hover:bg-atlas/20 transition-all uppercase tracking-widest">
                  Validar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Voice Section */}
        <div className="rounded-xl border border-bg-border bg-bg-card p-6 glass-card space-y-6">
          <h3 className="text-sm font-mono font-bold text-ink-primary uppercase italic">Interacción por Voz (MANDO AI)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div className="space-y-2">
                <label className="text-[10px] font-mono text-ink-muted uppercase">Voz de Respuesta (ElevenLabs)</label>
                <select className="w-full bg-bg-deep border border-bg-border rounded-lg px-4 py-2.5 text-xs font-mono text-ink-primary focus:outline-none focus:border-oracle/50">
                  <option>Adam (Premium)</option>
                  <option>Antoni (Expressive)</option>
                  <option>Bella (Narrative)</option>
                </select>
             </div>
             <div className="space-y-4 pt-6">
                <div className="flex items-center gap-3">
                   <input type="checkbox" className="w-4 h-4 rounded border-bg-border bg-bg-deep text-oracle" defaultChecked />
                   <span className="text-[10px] font-mono text-ink-secondary uppercase">Resúmenes por voz activados</span>
                </div>
                <div className="flex items-center gap-3">
                   <input type="checkbox" className="w-4 h-4 rounded border-bg-border bg-bg-deep text-oracle" defaultChecked />
                   <span className="text-[10px] font-mono text-ink-secondary uppercase">Confirmar trades por voz</span>
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  )
}
