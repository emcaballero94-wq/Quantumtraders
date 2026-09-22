import { NextResponse } from 'next/server'
import { rejectIfRateLimited } from '@/lib/server/endpoint-guards'

interface PulseBriefRequestBody {
  biasLabel: string
  biasIntensity: number
  bullishCount: number
  bearishCount: number
  neutralCount: number
  vixLabel: string
  vix: number | null
  strongestSector: string | null
  weakestSector: string | null
  relativeStrengthTop: { symbol: string; change90d: number | null }[]
  drawdownWorst: { symbol: string; maxDrawdownPct: number | null }[]
}

function fmtPct(value: number | null): string {
  if (value === null) return 'sin dato'
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`
}

export async function POST(request: Request) {
  const blocked = rejectIfRateLimited(request, {
    routeKey: 'market-pulse-brief',
    limit: 20,
    windowMs: 60_000,
  })
  if (blocked) return blocked

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { success: false, error: 'ANTHROPIC_API_KEY no está configurada. El resumen de IA no está disponible.' },
      { status: 200 },
    )
  }

  let body: PulseBriefRequestBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 })
  }

  const facts = [
    `Bias agregado del radar: ${body.biasLabel} (intensidad ${body.biasIntensity.toFixed(1)}/100)`,
    `Distribución: ${body.bullishCount} activos alcistas, ${body.bearishCount} bajistas, ${body.neutralCount} neutrales`,
    `Régimen de riesgo (VIX): ${body.vixLabel}${body.vix !== null ? ` (VIX ${body.vix.toFixed(1)})` : ''}`,
    body.strongestSector && body.weakestSector ? `Sector más fuerte: ${body.strongestSector} · Sector más débil: ${body.weakestSector}` : null,
    body.relativeStrengthTop.length > 0
      ? `Mejor fuerza relativa (90d) vs oro: ${body.relativeStrengthTop.map((r) => `${r.symbol} ${fmtPct(r.change90d)}`).join(', ')}`
      : null,
    body.drawdownWorst.length > 0
      ? `Mayor drawdown actual: ${body.drawdownWorst.map((d) => `${d.symbol} ${fmtPct(d.maxDrawdownPct)}`).join(', ')}`
      : null,
  ].filter(Boolean).join('\n')

  const prompt = `Eres un analista de mercado senior. Con base EXCLUSIVAMENTE en los siguientes datos reales (no inventes cifras ni hechos que no estén aquí), escribe un resumen de mercado de 4-6 líneas en español, directo y sin relleno, para un trader que revisa su panel de riesgo. No des recomendaciones de inversión explícitas.

DATOS:
${facts}

Devuelve solo el texto del resumen, sin títulos ni markdown.`

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
    console.error('[/api/market/pulse-brief] Error:', error)
    return NextResponse.json({ success: false, error: 'Failed to generate AI summary' }, { status: 502 })
  }
}
