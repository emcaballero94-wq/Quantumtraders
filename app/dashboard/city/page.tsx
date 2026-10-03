import { QuantumCityRoot } from '@/components/quantum-city/QuantumCityRoot'

export default function QuantumCityPage() {
  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <p className="text-[11px] font-mono uppercase tracking-[0.16em] text-pulse">QUANTUM CITY · PHASE 1</p>
        <h1 className="text-2xl font-sans font-medium text-ink-primary">Trading floor — shell</h1>
        <p className="text-sm font-sans text-ink-secondary max-w-2xl">
          Vista 3D del sistema de inteligencia de Quantum Traders. Cada estación corresponde a un motor real del
          dashboard — todavía no está conectada a datos en vivo (eso llega en la Fase 2), así que todo aparece IDLE.
        </p>
      </div>
      <QuantumCityRoot />
    </div>
  )
}
