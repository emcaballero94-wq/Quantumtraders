import { NextResponse } from 'next/server'
import { rejectIfRateLimited } from '@/lib/server/endpoint-guards'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface ChatRequestBody {
  messages: ChatMessage[]
}

const SYSTEM_PROMPT = `Eres MANDO, el asistente de IA integrado en Quantum Traders, una plataforma de análisis de mercados para traders. Conoces los módulos de la app: Oracle (radar de bias por activo y régimen de riesgo VIX), Atlas (gráficos en vivo), Nexus (matriz de correlaciones intermercado), y el Trade Journal (registro de operaciones).

Responde en español, de forma directa y breve (máximo 4-5 líneas), con tono de sala de mercados. No inventes precios, cifras ni datos de mercado en tiempo real que no te hayan sido proporcionados explícitamente en la conversación — si te preguntan por un dato que no tienes, dilo claramente en vez de inventarlo. No des recomendaciones de inversión explícitas (evita "compra" o "vende"); en su lugar, ofrece contexto y análisis.`

export async function POST(request: Request) {
  const blocked = rejectIfRateLimited(request, {
    routeKey: 'oracle-chat',
    limit: 20,
    windowMs: 60_000,
  })
  if (blocked) return blocked

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { success: false, error: 'ANTHROPIC_API_KEY no está configurada. El asistente de IA no está disponible.' },
      { status: 200 },
    )
  }

  let body: ChatRequestBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 })
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return NextResponse.json({ success: false, error: 'messages is required' }, { status: 400 })
  }

  const messages = body.messages
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-20)
    .map((m) => ({ role: m.role, content: m.content.trim().slice(0, 4000) }))

  if (messages.length === 0) {
    return NextResponse.json({ success: false, error: 'messages is required' }, { status: 400 })
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        system: SYSTEM_PROMPT,
        messages,
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

    return NextResponse.json({ success: true, data: { reply: text.trim() } })
  } catch (error) {
    console.error('[/api/oracle/chat] Error:', error)
    return NextResponse.json({ success: false, error: 'Failed to generate AI response' }, { status: 502 })
  }
}
