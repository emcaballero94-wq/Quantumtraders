import { NextResponse } from 'next/server'
import { rejectIfRateLimited } from '@/lib/server/endpoint-guards'
import type { CompanyProfile } from '@/lib/market-fundamentals'

interface BriefRequestBody {
  symbol: string
  profile: CompanyProfile
  quote: {
    price: number | null
    changePct: number | null
  }
}

function fmtNum(value: number | null, suffix = ''): string {
  if (value === null) return 'sin dato'
  return `${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}${suffix}`
}

function fmtPct(value: number | null): string {
  if (value === null) return 'sin dato'
  return `${(value * 100).toFixed(1)}%`
}

function fmtMoney(value: number | null): string {
  if (value === null) return 'sin dato'
  if (Math.abs(value) >= 1e9) return `$${(value / 1e9).toFixed(1)}B`
  if (Math.abs(value) >= 1e6) return `$${(value / 1e6).toFixed(1)}M`
  return `$${value.toLocaleString('en-US')}`
}

export async function POST(request: Request) {
  const blocked = rejectIfRateLimited(request, {
    routeKey: 'market-brief',
    limit: 30,
    windowMs: 60_000,
  })
  if (blocked) return blocked

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { success: false, error: 'ANTHROPIC_API_KEY no está configurada. El brief de IA no está disponible.' },
      { status: 200 },
    )
  }

  let body: BriefRequestBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 })
  }

  const { symbol, profile, quote } = body
  if (!symbol || !profile) {
    return NextResponse.json({ success: false, error: 'symbol and profile are required' }, { status: 400 })
  }

  const facts = [
    `Símbolo: ${symbol}${profile.name ? ` (${profile.name})` : ''}`,
    profile.sector ? `Sector: ${profile.sector}` : null,
    profile.industry ? `Industria: ${profile.industry}` : null,
    `Precio actual: ${fmtNum(quote?.price ?? null)} (${quote?.changePct !== null && quote?.changePct !== undefined ? `${quote.changePct >= 0 ? '+' : ''}${quote.changePct.toFixed(2)}%` : 'sin dato'} hoy)`,
    `Market cap: ${fmtMoney(profile.marketCap)}`,
    `P/E trailing: ${fmtNum(profile.peTrailing)} · P/E forward: ${fmtNum(profile.peForward)}`,
    `EPS: ${fmtNum(profile.eps)}`,
    `Beta: ${fmtNum(profile.beta)}`,
    `Rango 52 semanas: ${fmtNum(profile.fiftyTwoWeekLow)} - ${fmtNum(profile.fiftyTwoWeekHigh)}`,
    `Ingresos (TTM): ${fmtMoney(profile.revenueTtm)} · Crecimiento YoY: ${fmtPct(profile.revenueGrowthYoy)}`,
    `Margen bruto: ${fmtPct(profile.grossMargins)} · Margen neto: ${fmtPct(profile.profitMargins)}`,
    profile.recommendationKey ? `Recomendación de analistas: ${profile.recommendationKey} (${profile.analystCount ?? 0} analistas), precio objetivo promedio: ${fmtNum(profile.targetMeanPrice)}` : null,
  ].filter(Boolean).join('\n')

  const prompt = `Eres un analista financiero senior. Con base EXCLUSIVAMENTE en los siguientes datos reales (no inventes cifras ni hechos que no estén aquí), escribe un brief profesional de 4-6 líneas en español sobre ${symbol} para un trader. Cubre valoración, crecimiento, salud financiera y sentimiento de analistas si hay datos. Sé directo, sin relleno, sin emojis, sin recomendaciones de inversión explícitas (no digas "compra" o "vende").

DATOS:
${facts}

Devuelve solo el texto del brief, sin títulos ni markdown.`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!response.ok) {
      return NextResponse.json({ success: false, error: 'Claude API request failed' }, { status: 502 })
    }

    const result = await response.json()
    const text = result?.content?.[0]?.text
    if (typeof text !== 'string' || !text.trim()) {
      return NextResponse.json({ success: false, error: 'Empty response from Claude API' }, { status: 502 })
    }

    return NextResponse.json({ success: true, data: { brief: text.trim() } })
  } catch (error) {
    console.error('[/api/market/brief] Error:', error)
    return NextResponse.json({ success: false, error: 'Failed to generate AI brief' }, { status: 502 })
  }
}
