'use client'

import { useState, useEffect } from 'react'
import { clsx } from 'clsx'

interface QuantumCoreProps {
  isListening?: boolean;
  intensity?: 'low' | 'medium' | 'high';
}

export function QuantumCore({ isListening = false, intensity = 'low' }: QuantumCoreProps) {
  const [rotation, setRotation] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setRotation(prev => (prev + (isListening ? 5 : 1)) % 360)
    }, 50)
    return () => clearInterval(interval)
  }, [isListening])

  return (
    <div className="relative flex items-center justify-center w-64 h-64 select-none pointer-events-none">
      
      {/* Outer Rotating Rings */}
      <div 
        className="absolute inset-0 border-2 border-dashed border-oracle/20 rounded-full transition-all duration-1000"
        style={{ transform: `rotate(${rotation}deg) scale(${isListening ? 1.1 : 1})` }}
      />
      <div 
        className="absolute inset-4 border border-atlas/10 rounded-full transition-all duration-700"
        style={{ transform: `rotate(-${rotation * 1.5}deg)` }}
      />

      {/* Pulsing Core */}
      <div className={clsx(
        "relative w-24 h-24 rounded-full flex items-center justify-center transition-all duration-500 shadow-[0_0_50px_rgba(37,242,253,0.2)]",
        isListening ? "bg-oracle/20 scale-125" : "bg-oracle/10"
      )}>
        {/* Inner Glow */}
        <div className={clsx(
          "w-12 h-12 rounded-full blur-xl animate-pulse",
          isListening ? "bg-oracle/60" : "bg-oracle/40"
        )} />
        
        {/* Geometric Center */}
        <div className="absolute inset-0 flex items-center justify-center">
            <svg className="w-16 h-16 text-oracle opacity-80" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="0.5" strokeDasharray="5,5" />
                <path d="M50 10 L50 90 M10 50 L90 50" stroke="currentColor" strokeWidth="1" opacity="0.5" />
                <rect x="35" y="35" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1" transform={`rotate(${rotation})`} />
                <rect x="42.5" y="42.5" width="15" height="15" fill="currentColor" transform={`rotate(${-rotation * 2})`} />
            </svg>
        </div>
      </div>

      {/* Floating Orbits */}
      {[0, 72, 144, 216, 288].map((angle, i) => (
        <div 
          key={i}
          className="absolute w-2 h-2 rounded-full bg-oracle shadow-[0_0_10px_#25f2fd] transition-all duration-300"
          style={{
            transform: `rotate(${rotation + angle}deg) translate(80px) rotate(-${rotation + angle}deg)`,
            opacity: isListening ? 1 : 0.4
          }}
        />
      ))}

      {/* Scanner Beam */}
      {isListening && (
        <div className="absolute inset-0 bg-gradient-to-t from-oracle/20 to-transparent h-1/2 w-full origin-bottom animate-scanner-core" />
      )}

      {/* Data Readout (Visual only) */}
      <div className="absolute -bottom-12 flex flex-col items-center">
        <span className="text-[10px] font-mono text-oracle uppercase tracking-[0.3em] font-bold animate-pulse">
            {isListening ? 'ESCUCHANDO COMPRENSIÓN' : 'NÚCLEO CUÁNTICO ACTIVO'}
        </span>
        <div className="flex gap-1 mt-2">
            {[1, 2, 3, 4, 5].map(b => (
              <div key={b} className="w-1 h-3 bg-oracle/30 rounded-full overflow-hidden">
                <div className="w-full bg-oracle animate-pulse-slow" style={{ height: `${Math.random() * 100}%`, animationDelay: `${b * 0.2}s` }} />
              </div>
            ))}
        </div>
      </div>

    </div>
  )
}
