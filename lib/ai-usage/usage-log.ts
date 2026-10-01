import { createAdminClient } from '@/lib/supabase/admin'

// $ per 1M tokens. Every M.A.N.U./Oracle route currently calls the same
// model — add a row here if a route ever switches model.
const MODEL_PRICING_PER_MILLION: Record<string, { input: number; output: number }> = {
  'claude-haiku-4-5-20251001': { input: 1, output: 5 },
}

export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = MODEL_PRICING_PER_MILLION[model]
  if (!pricing) return 0
  return (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output
}

// Fire-and-forget from the caller's perspective — never throws. Logging
// spend should never break the AI response the trader is waiting on.
export async function logAiUsage(input: {
  route: string
  model: string
  usage: { input_tokens?: number; output_tokens?: number } | undefined
}): Promise<void> {
  const inputTokens = input.usage?.input_tokens ?? 0
  const outputTokens = input.usage?.output_tokens ?? 0
  if (inputTokens === 0 && outputTokens === 0) return

  const admin = createAdminClient()
  if (!admin) return

  try {
    await admin.from('ai_usage_log').insert({
      route: input.route,
      model: input.model,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      estimated_cost_usd: estimateCostUsd(input.model, inputTokens, outputTokens),
    })
  } catch (error) {
    console.error('[logAiUsage] Error:', error)
  }
}

export interface AiUsageSummary {
  route: string
  callCount: number
  inputTokens: number
  outputTokens: number
  costUsd: number
}

export async function getAiUsageSummary(sinceIso: string): Promise<AiUsageSummary[]> {
  const admin = createAdminClient()
  if (!admin) return []

  const { data, error } = await admin
    .from('ai_usage_log')
    .select('route, input_tokens, output_tokens, estimated_cost_usd')
    .gte('created_at', sinceIso)

  if (error || !data) return []

  const byRoute = new Map<string, AiUsageSummary>()
  for (const row of data as { route: string; input_tokens: number; output_tokens: number; estimated_cost_usd: number }[]) {
    const existing = byRoute.get(row.route) ?? { route: row.route, callCount: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 }
    existing.callCount += 1
    existing.inputTokens += row.input_tokens
    existing.outputTokens += row.output_tokens
    existing.costUsd += row.estimated_cost_usd
    byRoute.set(row.route, existing)
  }

  return [...byRoute.values()].sort((a, b) => b.costUsd - a.costUsd)
}
