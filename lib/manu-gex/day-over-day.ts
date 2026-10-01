import type { GexSnapshotRecord } from '@/lib/gex/snapshot-persistence'
import type { DayOverDayComparison, RegimeShift } from './types'

export interface CurrentGexAggregate {
  netGex: number
  callWallStrike: number | null
  putWallStrike: number | null
}

function regimeShift(priorNetGex: number, currentNetGex: number): RegimeShift {
  const priorPositive = priorNetGex >= 0
  const currentPositive = currentNetGex >= 0
  if (priorPositive && currentPositive) return 'UNCHANGED_POSITIVE'
  if (!priorPositive && !currentPositive) return 'UNCHANGED_NEGATIVE'
  return currentPositive ? 'FLIPPED_TO_POSITIVE' : 'FLIPPED_TO_NEGATIVE'
}

function strikeDelta(current: number | null, prior: number | null): number | null {
  return current !== null && prior !== null ? current - prior : null
}

// Builds the "today vs. the most recent prior session" comparison the brief
// narrates, from the live aggregate and a stored snapshot. The caller only
// has a comparison to make once the cron has captured at least one prior
// day for this symbol — until then there's nothing to diff against.
export function compareToSnapshot(current: CurrentGexAggregate, prior: GexSnapshotRecord): DayOverDayComparison {
  return {
    priorDate: prior.snapshotDate,
    priorNetGex: prior.netGex,
    priorCallWallStrike: prior.callWallStrike,
    priorPutWallStrike: prior.putWallStrike,
    priorGammaFlip: prior.gammaFlip,
    regimeShift: regimeShift(prior.netGex, current.netGex),
    netGexChangePct: prior.netGex !== 0 ? ((current.netGex - prior.netGex) / Math.abs(prior.netGex)) * 100 : null,
    callWallDeltaStrikes: strikeDelta(current.callWallStrike, prior.callWallStrike),
    putWallDeltaStrikes: strikeDelta(current.putWallStrike, prior.putWallStrike),
  }
}
