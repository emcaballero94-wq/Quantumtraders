'use client'

import { useEffect, useRef, memo } from 'react'

const TV_SYMBOL_MAP: Record<string, string> = {
  XAUUSD: 'OANDA:XAUUSD',
  EURUSD:  'OANDA:EURUSD',
  GBPUSD:  'OANDA:GBPUSD',
  BTCUSD:  'BINANCE:BTCUSDT',
  GBPJPY:  'OANDA:GBPJPY',
  USDJPY:  'OANDA:USDJPY',
  USDCAD:  'OANDA:USDCAD',
  EURCAD:  'OANDA:EURCAD',
  ETHUSD:  'BINANCE:ETHUSDT',
  XAGUSD:  'OANDA:XAGUSD',
  NASDAQ:  'NASDAQ:QQQ',
  SP500:   'AMEX:SPY',
  DXY:     'TVC:DXY',
}

interface TradingViewChartProps {
  symbol: string
  interval?: string
}

function TradingViewChartComponent({ symbol, interval = '60' }: TradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const tvSymbol = TV_SYMBOL_MAP[symbol] ?? `OANDA:${symbol}`

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    container.innerHTML = ''

    // The inner __widget div must also be 100% height for autosize to work
    const widgetDiv = document.createElement('div')
    widgetDiv.className = 'tradingview-widget-container__widget'
    widgetDiv.style.cssText = 'width:100%;height:100%;'
    container.appendChild(widgetDiv)

    const script = document.createElement('script')
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js'
    script.type = 'text/javascript'
    script.async = true
    script.innerHTML = JSON.stringify({
      autosize:            true,
      symbol:              tvSymbol,
      interval:            interval,
      timezone:            'Etc/UTC',
      theme:               'dark',
      style:               '1',
      locale:              'es',
      backgroundColor:     '#0D1017',
      gridColor:           '#1A1F2E',
      allow_symbol_change: false,
      save_image:          false,
      calendar:            false,
      hide_top_toolbar:    false,
      hide_legend:         false,
      hide_side_toolbar:   false,
      withdateranges:      true,
      hide_volume:         false,
      support_host:        'https://www.tradingview.com',
      studies: ['STD;EMA', 'STD;EMA', 'STD;Volume'],
      overrides: {
        'mainSeriesProperties.candleStyle.upColor':         '#22c55e',
        'mainSeriesProperties.candleStyle.downColor':       '#ef4444',
        'mainSeriesProperties.candleStyle.wickUpColor':     '#22c55e',
        'mainSeriesProperties.candleStyle.wickDownColor':   '#ef4444',
        'mainSeriesProperties.candleStyle.borderUpColor':   '#22c55e',
        'mainSeriesProperties.candleStyle.borderDownColor': '#ef4444',
        'paneProperties.background':                        '#0D1017',
        'paneProperties.backgroundType':                    'solid',
        'paneProperties.vertGridProperties.color':          '#1A1F2E',
        'paneProperties.horzGridProperties.color':          '#1A1F2E',
        'scalesProperties.textColor':                       '#8892A4',
      },
    })

    container.appendChild(script)

    return () => {
      container.innerHTML = ''
    }
  }, [tvSymbol, interval])

  return (
    <div
      ref={containerRef}
      className="tradingview-widget-container"
      style={{ width: '100%', height: '100%' }}
    />
  )
}

export const TradingViewChart = memo(TradingViewChartComponent)
