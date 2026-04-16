'use client'

import { clsx } from 'clsx'

interface Agent {
  id: string
  name: string
  specialty: string
  status: string
  score: number
  mind: string
}

export function AgentCard({ agent }: { agent: Agent }) {
  return (
    <div className="rounded-xl border border-bg-border bg-bg-card p-4 space-y-3 glass-card hover:border-oracle/40 transition-all cursor-default group">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
           <div className={clsx(
             "w-8 h-8 rounded-lg flex items-center justify-center font-mono font-bold text-xs",
             agent.id === 'atlas' ? "bg-atlas/10 text-atlas" : 
             agent.id === 'nexus' ? "bg-nexus/10 text-nexus" : "bg-pulse/10 text-pulse"
           )}>
             {agent.name[0]}
           </div>
           <div>
             <h4 className="text-xs font-mono font-bold text-ink-primary uppercase tracking-wider">{agent.name}</h4>
             <p className="text-[9px] font-mono text-ink-dim uppercase">{agent.specialty}</p>
           </div>
        </div>
        <div className="text-right">
           <span className="text-[10px] font-mono text-ink-muted uppercase">{agent.status}</span>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex justify-between items-center text-[9px] font-mono uppercase">
           <span className="text-ink-dim">Confidence</span>
           <span className="text-ink-primary">{agent.score}%</span>
        </div>
        <div className="h-1 w-full bg-bg-deep rounded-full overflow-hidden">
           <div 
             className={clsx(
               "h-full rounded-full transition-all duration-1000",
               agent.score > 70 ? "bg-atlas" : agent.score > 50 ? "bg-oracle" : "bg-pulse"
             )} 
             style={{ width: `${agent.score}%` }} 
           />
        </div>
      </div>

      <div className="pt-2 border-t border-bg-border/50 flex items-center justify-between">
         <span className="text-[9px] font-mono text-ink-dim uppercase">Estado: {agent.mind}</span>
         <div className="w-1.5 h-1.5 rounded-full bg-atlas animate-pulse" />
      </div>
    </div>
  )
}
