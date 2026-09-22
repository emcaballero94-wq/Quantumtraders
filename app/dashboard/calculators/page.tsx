'use client'

import { LotCalculator } from '@/components/tools/LotCalculator'

export default function CalculatorsPage() {
  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="border-b border-bg-border pb-6">
        <h1 className="text-xl font-mono font-bold text-ink-primary tracking-tight uppercase">Calculators</h1>
        <p className="text-xs font-mono text-ink-muted mt-0.5 tracking-wider uppercase">Position sizing &amp; lot calculator</p>
      </div>

      <div className="max-w-md">
        <LotCalculator />
      </div>
    </div>
  )
}
