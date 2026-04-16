'use client'

import { useEffect, useRef } from 'react'

interface TickData {
  symbol: string
  price: number
  timestamp: number
}

export function useTwelveDataWS(symbol: string, onTick: (tick: TickData) => void) {
  const ws = useRef<WebSocket | null>(null)

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_TWELVE_DATA_API_KEY // Note: For WS, sometimes it's public or we proxy
    if (!apiKey) return

    // Convert symbol (XAUUSD -> XAU/USD)
    const wsSymbol = symbol.includes('USD') && !symbol.includes('/') 
      ? `${symbol.slice(0, -3)}/USD` 
      : symbol

    console.log(`Connecting to WebSocket for ${wsSymbol}...`)
    
    ws.current = new WebSocket('wss://ws.twelvedata.com/v1/quotes/price?apikey=' + apiKey)

    ws.current.onopen = () => {
      ws.current?.send(JSON.stringify({
        action: 'subscribe',
        params: {
          symbols: wsSymbol
        }
      }))
    }

    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data)
      if (data.event === 'price') {
        onTick({
          symbol: data.symbol,
          price: parseFloat(data.price),
          timestamp: data.timestamp
        })
      }
    }

    ws.current.onerror = (error) => {
      console.error('WS Error:', error)
    }

    return () => {
      if (ws.current) {
        ws.current.close()
      }
    }
  }, [symbol, onTick])
}
