'use client'

import { 
    createChart, 
    ColorType, 
    CandlestickSeries, 
    LineSeries 
} from 'lightweight-charts'
import { useEffect, useRef } from 'react'

interface CandleData {
    time: string;
    open: number;
    high: number;
    low: number;
    close: number;
}

interface LineData {
    time: string;
    value: number;
}

interface Zone {
    label: string;
    top: number;
    bottom: number;
    color: string;
}

interface ChartComponentProps {
    data: CandleData[];
    ema21?: LineData[];
    ema50?: LineData[];
    zones?: Zone[];
    colors?: {
        backgroundColor?: string;
        textColor?: string;
    }
}

export const ChartComponent = ({ 
    data, 
    ema21 = [], 
    ema50 = [], 
    zones = [], 
    colors = {} 
}: ChartComponentProps) => {
    const {
        backgroundColor = '#0D1017',
        textColor = '#8892A4',
    } = colors;

    const chartContainerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!chartContainerRef.current) return

        const handleResize = () => {
            if (chartContainerRef.current) {
                chart.applyOptions({ width: chartContainerRef.current.clientWidth })
            }
        }

        const chart = createChart(chartContainerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: backgroundColor },
                textColor,
            },
            grid: {
                vertLines: { color: '#1A1F2E' },
                horzLines: { color: '#1A1F2E' },
            },
            width: chartContainerRef.current.clientWidth,
            height: 500,
            timeScale: {
                borderColor: '#1A1F2E',
                timeVisible: true,
            },
            rightPriceScale: {
                borderColor: '#1A1F2E',
            }
        })

        // 1. Candlestick Series (Price)
        // In v5, we use addSeries(CandlestickSeries, options)
        const candleSeries = chart.addSeries(CandlestickSeries, {
            upColor: '#22c55e',
            downColor: '#ef4444',
            borderVisible: false,
            wickUpColor: '#22c55e',
            wickDownColor: '#ef4444',
        })
        candleSeries.setData(data)

        // 2. EMA 21
        if (ema21.length > 0) {
            const ema21Series = chart.addSeries(LineSeries, {
                color: '#25f2fd', 
                lineWidth: 2,
                title: 'EMA 21',
            })
            ema21Series.setData(ema21)
        }

        // 3. EMA 50
        if (ema50.length > 0) {
            const ema50Series = chart.addSeries(LineSeries, {
                color: '#8b5cf6', 
                lineWidth: 2,
                title: 'EMA 50',
            })
            ema50Series.setData(ema50)
        }

        // 4. Structural Zones
        zones.forEach(zone => {
           candleSeries.createPriceLine({
               price: zone.top,
               color: zone.color,
               lineWidth: 1,
               lineStyle: 2, 
               axisLabelVisible: true,
               title: `${zone.label} Top`,
           });
           candleSeries.createPriceLine({
               price: zone.bottom,
               color: zone.color,
               lineWidth: 1,
               lineStyle: 2, 
               axisLabelVisible: true,
               title: `${zone.label} Bot`,
           });
        });

        chart.timeScale().fitContent()

        window.addEventListener('resize', handleResize)

        return () => {
            window.removeEventListener('resize', handleResize)
            chart.remove()
        }
    }, [data, ema21, ema50, zones, backgroundColor, textColor])

    return (
        <div ref={chartContainerRef} className="w-full rounded-xl border border-bg-border overflow-hidden bg-[#0D1017]" />
    )
}
