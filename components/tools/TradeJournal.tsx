'use client'

export interface Trade {
  id: string | number;
  symbol: string;
  type: string;
  result: string;
  profit: number;
  date: string;
}

interface TradeJournalProps {
  trades: Trade[];
  loading?: boolean;
}

export function TradeJournal({ trades, loading = false }: TradeJournalProps) {
  const totalProfit = trades.reduce((acc, trade) => acc + trade.profit, 0)
  const closedTrades = trades.filter((trade) => trade.result !== 'OPEN')
  const winTrades = closedTrades.filter((trade) => trade.profit > 0)
  const winRate = closedTrades.length > 0 ? Math.round((winTrades.length / closedTrades.length) * 100) : 0

  return (
    <div className="rounded-xl border border-bg-border bg-bg-deep overflow-hidden flex flex-col glass h-full">
      <div className="px-5 py-4 border-b border-bg-border bg-bg-card/50 flex items-center justify-between">
        <h3 className="text-xs font-mono font-bold text-ink-primary uppercase tracking-widest">Registro de Operaciones</h3>
        <button className="text-[10px] font-mono text-oracle hover:underline uppercase">Nuevo Registro</button>
      </div>
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-left font-mono text-xs">
          <thead>
            <tr className="border-b border-bg-border text-[9px] text-ink-dim uppercase">
              <th className="px-5 py-2 font-semibold">Par</th>
              <th className="px-5 py-2 font-semibold">Tipo</th>
              <th className="px-5 py-2 font-semibold">Resultado</th>
              <th className="px-5 py-2 font-semibold text-right">P/L</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-bg-border/50">
            {loading && (
              <tr>
                <td colSpan={4} className="px-5 py-8 text-center text-ink-dim text-xs">Cargando journal...</td>
              </tr>
            )}
            {!loading && trades.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-8 text-center text-ink-dim text-xs">Sin operaciones registradas.</td>
              </tr>
            )}
            {!loading && trades.map((t) => (
              <tr key={t.id} className="hover:bg-bg-elevated/40 transition-colors">
                <td className="px-5 py-3 font-bold text-ink-primary">{t.symbol}</td>
                <td className="px-5 py-3">
                  <span className={t.type === 'BUY' ? 'text-atlas' : 'text-bear'}>{t.type}</span>
                </td>
                <td className="px-5 py-3 text-ink-secondary">{t.result}</td>
                <td className={`px-5 py-3 text-right font-bold ${t.profit >= 0 ? 'text-atlas' : 'text-bear'}`}>
                  {t.profit >= 0 ? '+' : ''}{t.profit}$
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="p-4 border-t border-bg-border bg-bg-card/30 flex justify-between items-center">
         <span className="text-[10px] text-ink-dim uppercase">Win Rate: {winRate}%</span>
         <span className="text-[10px] text-ink-dim uppercase tracking-widest">Operaciones Totales: {trades.length} · P/L {totalProfit >= 0 ? '+' : ''}{totalProfit}$</span>
      </div>
    </div>
  )
}
