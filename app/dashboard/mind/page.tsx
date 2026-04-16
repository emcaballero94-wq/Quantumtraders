import { clsx } from 'clsx'
import { SectionTitle } from '@/components/ui/SectionTitle'

export default function MindPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-mono font-bold text-ink-primary tracking-tight uppercase">MIND · Psychology Unit</h1>
          <p className="text-xs font-mono text-ink-muted mt-0.5">Gestión emocional · Bitácora · Estado Cognitivo</p>
        </div>
        <div className="px-3 py-1.5 bg-pulse/10 border border-pulse/30 rounded-lg">
           <span className="text-2xs font-mono text-pulse font-bold">ACCESO BETA</span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Left Side: Cognitive Status */}
        <div className="xl:col-span-1 space-y-6">
          <div className="rounded-xl border border-bg-border bg-bg-card p-6 glass-card relative overflow-hidden">
             <div className="absolute top-0 right-0 p-4 opacity-10">
                <svg className="w-24 h-24 text-ink-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
             </div>
             <SectionTitle label="Estado Cognitivo" accent="oracle" />
             <div className="mt-8 space-y-6">
                <StatusLevel label="Enfoque" level={85} color="text-atlas" />
                <StatusLevel label="Disciplina" level={92} color="text-atlas" />
                <StatusLevel label="Fatiga" level={20} color="text-bear" />
                <StatusLevel label="Ansiedad" level={15} color="text-bear" />
             </div>
             <div className="mt-8 p-4 bg-bg-deep border border-bg-border rounded-lg">
               <p className="text-2xs font-mono text-ink-muted leading-relaxed italic">
                 "Tu mejor indicador es tu claridad mental. Si el mercado está errático, protégete a ti mismo primero."
               </p>
             </div>
          </div>
        </div>

        {/* Center: Journaling Shell */}
        <div className="xl:col-span-2 space-y-6">
          <div className="rounded-xl border border-bg-border bg-bg-card flex flex-col h-[600px] overflow-hidden">
            <div className="p-4 border-b border-bg-border flex items-center justify-between bg-bg-card/50">
               <h3 className="text-xs font-mono font-bold text-ink-primary uppercase tracking-widest">Bitácora de Sesión</h3>
               <div className="text-[10px] font-mono text-ink-dim uppercase">Sesión: NY OPEN</div>
            </div>
            <div className="flex-1 p-6 space-y-6 overflow-y-auto font-mono">
               <div className="opacity-40 flex flex-col items-center justify-center h-full space-y-4">
                  <svg className="w-12 h-12 text-ink-dim" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  <p className="text-xs text-ink-dim">Empieza a escribir tus notas de hoy...</p>
               </div>
            </div>
            <div className="p-4 border-t border-bg-border bg-bg-deep">
               <div className="flex items-center gap-3">
                  <input 
                    type="text" 
                    placeholder="Escribe un pensamiento rápido o insight..." 
                    className="flex-1 bg-bg-card border border-bg-border rounded-lg px-4 py-2.5 text-xs font-mono text-ink-primary focus:outline-none focus:border-oracle/50"
                  />
                  <button className="px-4 py-2.5 bg-oracle/10 text-oracle border border-oracle/30 rounded-lg text-xs font-mono font-bold hover:bg-oracle/20 transition-all uppercase tracking-wider">
                    Guardar
                  </button>
               </div>
            </div>
          </div>
        </div>

      </div>

    </div>
  )
}

function StatusLevel({ label, level, color }: { label: string; level: number; color: string }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-2xs font-mono uppercase tracking-wider">
        <span className="text-ink-muted">{label}</span>
        <span className={clsx("font-bold", color)}>{level}%</span>
      </div>
      <div className="h-1 w-full bg-bg-border rounded-full overflow-hidden">
        <div 
          className={clsx("h-full rounded-full transition-all duration-1000", color.replace('text-', 'bg-'))} 
          style={{ width: `${level}%` }} 
        />
      </div>
    </div>
  )
}
