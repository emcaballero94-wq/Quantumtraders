import { QuantumCityRoot } from '@/components/quantum-city/QuantumCityRoot'

export default function QuantumCityPage() {
  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <p className="text-[11px] font-mono uppercase tracking-[0.16em] text-pulse">QUANTUM CITY</p>
        <h1 className="text-2xl font-sans font-medium text-ink-primary">Trading floor</h1>
        <p className="text-sm font-sans text-ink-secondary max-w-2xl">
          Vista 3D del sistema de inteligencia de Quantum Traders. Cada estación corresponde a un motor real del
          dashboard: su equipo trabaja cuando ese motor tiene actividad reciente, y cada evento nuevo viaja hasta MANDO.
          Las estaciones sin backend aparecen apagadas.
        </p>
      </div>
      <QuantumCityRoot />
    </div>
  )
}
