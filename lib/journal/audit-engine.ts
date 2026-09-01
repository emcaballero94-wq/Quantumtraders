import type { TradeJournalEntry, TradeChecklist } from '@/lib/oracle/persistence'

export interface ExecutionFlag {
  label: string
  status: 'good' | 'warning' | 'bad'
  detail: string
}

export interface AuditPattern {
  title: string
  description: string
}

export interface TradeAuditStats {
  totalTrades: number
  closedTrades: number
  winRate: number | null
  profitFactor: number | null
  avgR: number | null
  rSampleSize: number
  maxDrawdown: number | null
  netProfit: number
  flags: ExecutionFlag[]
  patterns: AuditPattern[]
  hasEnoughDataForPatterns: boolean
}

const MIN_TRADES_FOR_PATTERNS = 10

function computeRMultiple(trade: TradeJournalEntry): number | null {
  if (trade.entryPrice == null || trade.stopLoss == null || trade.exitPrice == null) return null
  const risk = Math.abs(trade.entryPrice - trade.stopLoss)
  if (risk === 0) return null
  const reward = trade.side === 'BUY'
    ? trade.exitPrice - trade.entryPrice
    : trade.entryPrice - trade.exitPrice
  return reward / risk
}

function computeMaxDrawdown(closed: TradeJournalEntry[]): number | null {
  if (closed.length === 0) return null
  const chronological = [...closed].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  let equity = 0
  let peak = 0
  let maxDD = 0
  for (const trade of chronological) {
    equity += trade.profit
    peak = Math.max(peak, equity)
    maxDD = Math.max(maxDD, peak - equity)
  }
  return maxDD
}

/**
 * Every number here is computed from real stored trades — no placeholders,
 * no invented sample stats. Anything that needs data the trade doesn't have
 * yet (e.g. avgR needs exitPrice, which isn't captured until the manual
 * entry form or an MT5 feed populates it) is simply excluded from the
 * average and its sample size is reported, rather than faked.
 */
export function computeTradeAudit(
  trades: TradeJournalEntry[],
  checklists: Record<string, TradeChecklist>,
): TradeAuditStats {
  const closed = trades.filter((t) => t.result !== 'OPEN')
  const wins = closed.filter((t) => t.profit > 0)
  const losses = closed.filter((t) => t.profit < 0)

  const winRate = closed.length > 0 ? (wins.length / closed.length) * 100 : null

  const grossWin = wins.reduce((sum, t) => sum + t.profit, 0)
  const grossLoss = Math.abs(losses.reduce((sum, t) => sum + t.profit, 0))
  const profitFactor = grossLoss > 0 ? grossWin / grossLoss : (grossWin > 0 ? Infinity : null)

  const rValues = closed.map(computeRMultiple).filter((r): r is number => r !== null)
  const avgR = rValues.length > 0 ? rValues.reduce((a, b) => a + b, 0) / rValues.length : null

  const netProfit = closed.reduce((sum, t) => sum + t.profit - t.commission - t.swap, 0)
  const maxDrawdown = computeMaxDrawdown(closed)

  // ── Execution flags — real consistency checks over the checklist data ──
  const flags: ExecutionFlag[] = []
  const withChecklist = closed.filter((t) => checklists[t.id])

  if (withChecklist.length > 0) {
    const riskPct = (withChecklist.filter((t) => checklists[t.id]?.preRisk).length / withChecklist.length) * 100
    flags.push({
      label: 'Risk consistency',
      status: riskPct >= 80 ? 'good' : riskPct >= 50 ? 'warning' : 'bad',
      detail: `Pre-trade risk check confirmed on ${riskPct.toFixed(0)}% of logged trades`,
    })

    const slSetPct = (closed.filter((t) => t.stopLoss !== null).length / closed.length) * 100
    flags.push({
      label: 'SL discipline',
      status: slSetPct >= 90 ? 'good' : slSetPct >= 60 ? 'warning' : 'bad',
      detail: `${slSetPct.toFixed(0)}% of closed trades had a stop loss recorded`,
    })

    const stablePct = (withChecklist.filter((t) => checklists[t.id]?.postEmotionStable).length / withChecklist.length) * 100
    flags.push({
      label: 'Emotional stability',
      status: stablePct >= 80 ? 'good' : stablePct >= 50 ? 'warning' : 'bad',
      detail: `Reported stable during ${stablePct.toFixed(0)}% of logged trades`,
    })
  }

  const dayCounts = new Map<string, number>()
  for (const trade of closed) {
    const day = trade.createdAt.slice(0, 10)
    dayCounts.set(day, (dayCounts.get(day) ?? 0) + 1)
  }
  const overtradingDays = [...dayCounts.values()].filter((count) => count >= 4).length
  if (dayCounts.size > 0) {
    const overtradingPct = (overtradingDays / dayCounts.size) * 100
    flags.push({
      label: 'Overtrading',
      status: overtradingPct <= 10 ? 'good' : overtradingPct <= 30 ? 'warning' : 'bad',
      detail: overtradingDays > 0
        ? `${overtradingDays} of ${dayCounts.size} trading days had 4+ trades`
        : 'No days with 4 or more trades',
    })
  }

  // ── Patterns — only surfaced once there's enough closed volume to mean anything ──
  const patterns: AuditPattern[] = []
  const hasEnoughDataForPatterns = closed.length >= MIN_TRADES_FOR_PATTERNS

  if (hasEnoughDataForPatterns) {
    // Pattern: losses clustering on high-frequency trading days
    const lossesOnOvertradingDays = losses.filter((t) => (dayCounts.get(t.createdAt.slice(0, 10)) ?? 0) >= 3).length
    if (losses.length > 0) {
      const pct = (lossesOnOvertradingDays / losses.length) * 100
      if (pct >= 40) {
        patterns.push({
          title: 'Losses cluster on high-frequency days',
          description: `${pct.toFixed(0)}% of your losing trades happened on a day with 3 or more trades already taken.`,
        })
      }
    }

    // Pattern: emotion tag correlates with worse win rate
    const tagged = closed.filter((t) => checklists[t.id]?.emotionTag)
    const tagGroups = new Map<string, TradeJournalEntry[]>()
    for (const trade of tagged) {
      const tag = checklists[trade.id]!.emotionTag!
      tagGroups.set(tag, [...(tagGroups.get(tag) ?? []), trade])
    }
    const baselineWinRate = winRate
    for (const [tag, group] of tagGroups) {
      if (group.length < 5 || baselineWinRate === null) continue
      const groupWinRate = (group.filter((t) => t.profit > 0).length / group.length) * 100
      if (groupWinRate < baselineWinRate - 15) {
        patterns.push({
          title: `"${tag}" trades underperform`,
          description: `${group.length} trades tagged "${tag}" had a ${groupWinRate.toFixed(0)}% win rate, vs. ${baselineWinRate.toFixed(0)}% overall.`,
        })
      }
    }
  }

  return {
    totalTrades: trades.length,
    closedTrades: closed.length,
    winRate,
    profitFactor,
    avgR,
    rSampleSize: rValues.length,
    maxDrawdown,
    netProfit,
    flags,
    patterns,
    hasEnoughDataForPatterns,
  }
}
