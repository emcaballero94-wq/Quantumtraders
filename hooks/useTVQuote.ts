'use client'

/**
 * useTVQuote — fetches live price data from TradingView (via our proxy)
 * Same source as the TV chart widget, so values will always match.
 *
 * @param symbols  Array of internal symbols, e.g. ['XAUUSD', 'EURUSD']
 * @param interval Polling interval in ms (default 3000 = 3 seconds)
 */
import { useState, useEffect, useCallback } from 'react'

export interface TVQuote {
  symbol:      string
  providerSymbol: string
  price:       number | null
  change:      number | null
  changePct:   number | null
  open:        number | null
  prevClose:   number | null
  high:        number | null
  low:         number | null
  volume:      number | null
  currency:    string | null
  description: string
  timestamp:   number
}

export function useTVQuote(symbols: string[], interval = 3000) {
  const [quotes, setQuotes]   = useState<Record<string, TVQuote>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const symbolsKey = symbols.join(',')

  const fetchQuotes = useCallback(async () => {
    if (symbols.length === 0) return
    try {
      const res  = await fetch(`/api/market/quote?symbols=${symbolsKey}`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      const map: Record<string, TVQuote> = {}
      for (const q of data.quotes as TVQuote[]) {
        map[q.symbol] = q
      }
      setQuotes(prev => ({ ...prev, ...map }))
      setError(null)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [symbols.length, symbolsKey])

  useEffect(() => {
    fetchQuotes()
    const timer = setInterval(fetchQuotes, interval)
    return () => clearInterval(timer)
  }, [fetchQuotes, interval])

  return { quotes, loading, error }
}
