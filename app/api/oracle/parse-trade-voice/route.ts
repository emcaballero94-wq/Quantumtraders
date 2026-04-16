import { NextResponse } from 'next/server'
import { rejectIfRateLimited } from '@/lib/server/endpoint-guards'

export async function POST(request: Request) {
  const blocked = rejectIfRateLimited(request, {
    routeKey: 'oracle-parse-voice',
    limit: 30,
    windowMs: 60_000,
  })
  if (blocked) return blocked

  const { transcript } = await request.json()
  const apiKey = process.env.ANTHROPIC_API_KEY

  if (!apiKey) {
    return NextResponse.json(
      { error: 'Anthropic API Key not configured' },
      { status: 500 }
    )
  }

  try {
    const prompt = `
Actúa como un asistente financiero inteligente (JARVIS).
Tu misión es extraer los detalles de un trade a partir del comando de voz del usuario.

Usuario dijo: "${transcript}"

Extrae los siguientes detalles y devuélvelos en formato JSON estricto:
- "symbol": el par (ej. "XAUUSD", "EURUSD", "BTCUSD"). Intuye a partir de "oro", "euro", etc.
- "type": "BUY" o "SELL" (largo/compra = BUY, corto/venta = SELL)
- "size": tamaño del lote numérico (ej. 0.5, 1.0). Si dice "medio lote", es 0.5. Si no dice, pon null.
- "entry": precio de entrada (numérico), si lo dice. Si no, pon null.
- "sl": precio de stop loss (numérico). Si no, pon null.
- "tp": precio de take profit (numérico). Si no, pon null.
- "response": un mensaje conversacional muy breve de 1 línea confirmando la acción (ej. "Entendido señor, registrando compra en Oro de medio lote con stop en 2335.").

Devuelve SOLO el JSON válido, sin markdown ni explicaciones.
`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }]
      })
    })

    const result = await response.json()
    const content = result.content[0].text
    
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    const tradeData = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(content)

    return NextResponse.json(tradeData)
  } catch (error: any) {
    console.error('Claude API Error:', error)
    return NextResponse.json({ error: 'Fallo al procesar el audio' }, { status: 500 })
  }
}
