'use client'

import { useState } from 'react'
import { clsx } from 'clsx'
import { OrderBookHeatmap } from '@/components/orderflow/OrderBookHeatmap'

const SYMBOLS = [
  { label: 'BTC/USDT', value: 'btcusdt' },
  { label: 'ETH/USDT', value: 'ethusdt' },
]

export default function OrderFlowPage() {
  const [symbol, setSymbol] = useState(SYMBOLS[0].value)

  return (
    <div className="animate-fade-in pb-20 max-w-[640px]">
      <div className="rounded-xl border border-bg-border bg-bg-base overflow-hidden mb-4">
        <div className="flex items-baseline gap-3.5 flex-wrap px-7 py-[18px] border-b border-bg-border">
          <h1 className="text-[22px] font-sans font-medium text-ink-primary">Order Flow</h1>
          <span className="text-xs font-mono text-ink-secondary">Profundidad de mercado en vivo · Binance</span>
        </div>
        <div className="flex gap-2 px-7 py-4">
          {SYMBOLS.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => setSymbol(s.value)}
              className={clsx(
                'px-3 py-1.5 rounded-md text-xs font-mono uppercase tracking-wider border transition-colors',
                symbol === s.value
                  ? 'border-oracle/50 bg-oracle/10 text-oracle'
                  : 'border-bg-border text-ink-secondary hover:border-ink-muted',
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <OrderBookHeatmap symbol={symbol} levels={10} />

      <p className="mt-4 text-xs font-sans leading-relaxed text-ink-dim">
        Libro de órdenes en vivo de Binance (top 20 niveles por lado, actualizado cada 100ms) — conexión directa
        desde el navegador, sin intermediarios. Por ahora solo cripto: futuros (oro, índices, petróleo) y forex
        requieren un feed de datos Level 2 de pago (Databento, Rithmic, CQG) que todavía no está conectado.
      </p>
    </div>
  )
}
