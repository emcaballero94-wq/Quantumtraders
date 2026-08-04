import Link from 'next/link'
import { SectionTitle } from '@/components/ui/SectionTitle'

export default function MindPage() {
  return (
    <div className="space-y-6 animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-mono font-bold text-ink-primary tracking-tight uppercase">MIND · Psychology Unit</h1>
          <p className="text-xs font-mono text-ink-muted mt-0.5">Gestión emocional · Estado cognitivo</p>
        </div>
        <div className="px-3 py-1.5 bg-pulse/10 border border-pulse/30 rounded-lg">
          <span className="text-2xs font-mono text-pulse font-bold">EN DESARROLLO</span>
        </div>
      </div>

      <div className="rounded-xl border border-bg-border bg-bg-card p-8 glass-card relative overflow-hidden text-center max-w-2xl mx-auto">
        <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-pulse/10 border border-pulse/25 flex items-center justify-center">
          <svg className="w-6 h-6 text-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
        </div>
        <SectionTitle label="Módulo en construcción" accent="pulse" className="justify-center mb-3" />
        <p className="text-xs font-mono text-ink-muted leading-relaxed max-w-md mx-auto">
          Estamos construyendo el seguimiento de estado cognitivo (enfoque, disciplina, fatiga) conectado
          a tus sesiones reales de trading. Todavía no hay datos en vivo aquí — preferimos no mostrarte
          números inventados.
        </p>
        <p className="text-2xs font-mono text-ink-dim mt-4">
          Mientras tanto, tu bitácora de trades ya funciona en{' '}
          <Link href="/dashboard/tools" className="text-oracle hover:underline">
            TOOLS · Trade Journal
          </Link>.
        </p>
      </div>

    </div>
  )
}
