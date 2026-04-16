import type { MarketSession, KillZone, TimingAlignment, SessionName } from './types'
import { clamp } from './indicators'

// ─── Session Definitions (UTC times) ─────────────────────────

const SESSIONS: Omit<MarketSession, 'isActive' | 'killZone'>[] = [
  {
    name:     'Sydney',
    openUTC:  '21:00',
    closeUTC: '06:00',
    quality:  'low',
    pairs:    ['AUDUSD', 'NZDUSD', 'AUDNZD', 'AUDJPY'],
  },
  {
    name:     'Tokyo',
    openUTC:  '00:00',
    closeUTC: '09:00',
    quality:  'medium',
    pairs:    ['USDJPY', 'EURJPY', 'GBPJPY', 'AUDJPY', 'XAUUSD'],
  },
  {
    name:     'London',
    openUTC:  '07:00',
    closeUTC: '16:00',
    quality:  'high',
    pairs:    ['EURUSD', 'GBPUSD', 'EURGBP', 'EURJPY', 'GBPJPY', 'XAUUSD'],
  },
  {
    name:     'New York',
    openUTC:  '12:00',
    closeUTC: '21:00',
    quality:  'high',
    pairs:    ['EURUSD', 'GBPUSD', 'USDJPY', 'USDCAD', 'XAUUSD', 'BTCUSD'],
  },
]

// ─── Kill Zone Definitions ───────────────────────────────────

const KILL_ZONES: Omit<KillZone, 'isActive'>[] = [
  {
    name:     'London Open Kill Zone',
    session:  'London',
    startUTC: '07:00',
    endUTC:   '10:00',
  },
  {
    name:     'New York Open Kill Zone',
    session:  'New York',
    startUTC: '12:00',
    endUTC:   '15:00',
  },
  {
    name:     'London Close Kill Zone',
    session:  'London',
    startUTC: '15:00',
    endUTC:   '16:00',
  },
  {
    name:     'Asian Range Kill Zone',
    session:  'Tokyo',
    startUTC: '00:00',
    endUTC:   '02:00',
  },
]

// ─── Time Helpers ────────────────────────────────────────────

function parseUTCHHMM(hhmm: string): { h: number; m: number } {
  const [h, m] = hhmm.split(':').map(Number)
  return { h: h ?? 0, m: m ?? 0 }
}

function toUTCMinutes(date: Date): number {
  return date.getUTCHours() * 60 + date.getUTCMinutes()
}

function parseToMinutes(hhmm: string): number {
  const { h, m } = parseUTCHHMM(hhmm)
  return h * 60 + m
}

/**
 * Returns true if `current` is within [start, end) (handles midnight crossover)
 */
function isInWindow(currentMin: number, startHHMM: string, endHHMM: string): boolean {
  const start = parseToMinutes(startHHMM)
  const end   = parseToMinutes(endHHMM)

  if (start < end) {
    return currentMin >= start && currentMin < end
  }
  // Wraps midnight (e.g. Sydney 21:00–06:00)
  return currentMin >= start || currentMin < end
}

// ─── Get Active Sessions ─────────────────────────────────────

export function getActiveSessions(now: Date = new Date()): MarketSession[] {
  const currentMin = toUTCMinutes(now)

  return SESSIONS.map((s) => {
    const isActive  = isInWindow(currentMin, s.openUTC, s.closeUTC)
    const killZone  = isActive && KILL_ZONES.some(
      (kz) => kz.session === s.name && isInWindow(currentMin, kz.startUTC, kz.endUTC),
    )
    return { ...s, isActive, killZone }
  })
}

// ─── Get Active Kill Zones ────────────────────────────────────

export function getActiveKillZones(now: Date = new Date()): KillZone[] {
  const currentMin = toUTCMinutes(now)
  return KILL_ZONES.map((kz) => ({
    ...kz,
    isActive: isInWindow(currentMin, kz.startUTC, kz.endUTC),
  }))
}

// ─── Get Next Session ────────────────────────────────────────

export function getNextSession(
  sessions:   MarketSession[],
  now:        Date = new Date(),
): MarketSession | null {
  const currentMin = toUTCMinutes(now)

  let minDelta  = Infinity
  let nextSess: MarketSession | null = null

  for (const s of sessions) {
    if (s.isActive) continue
    const openMin = parseToMinutes(s.openUTC)
    let delta = openMin - currentMin
    if (delta < 0) delta += 24 * 60   // wrap to next day
    if (delta < minDelta) {
      minDelta  = delta
      nextSess  = s
    }
  }

  return nextSess
}

// ─── Timing Score ────────────────────────────────────────────

/**
 * Symbols that perform well in a specific session
 */
function symbolFitsSession(symbol: string, sessions: MarketSession[]): boolean {
  const upper = symbol.toUpperCase()
  return sessions.some((s) => s.isActive && s.pairs.some((p) => upper.includes(p) || p.includes(upper)))
}

function calcTimingScore(
  symbol:     string,
  sessions:   MarketSession[],
  killZones:  KillZone[],
): number {
  const activeSessions  = sessions.filter((s) => s.isActive)
  const activeKillZones = killZones.filter((kz) => kz.isActive)
  const fits            = symbolFitsSession(symbol, sessions)

  if (activeSessions.length === 0) return 10   // dead zone

  let score = 30   // baseline for any active session

  // Boost for quality sessions
  const inHighQuality = activeSessions.some((s) => s.quality === 'high')
  const inMedQuality  = activeSessions.some((s) => s.quality === 'medium')
  if (inHighQuality)  score += 25
  else if (inMedQuality) score += 10

  // Boost for kill zone
  if (activeKillZones.length > 0) score += 30

  // Boost for symbol fit
  if (fits) score += 15

  // Penalty: overlapping sessions (London + NY) = best time
  const highQCount = activeSessions.filter((s) => s.quality === 'high').length
  if (highQCount >= 2) score += 10

  return clamp(score)
}

// ─── Main Engine ─────────────────────────────────────────────

export function analyzeTiming(symbol: string, now: Date = new Date()): TimingAlignment {
  const sessions  = getActiveSessions(now)
  const killZones = getActiveKillZones(now)

  const activeSession  = sessions.find((s) => s.isActive)
  const activeKillZone = killZones.find((kz) => kz.isActive) ?? null
  const nextSession    = getNextSession(sessions, now)
  const timingScore    = calcTimingScore(symbol, sessions, killZones)

  return {
    symbol,
    timingScore,
    activeSession:  (activeSession?.name ?? 'Off') as SessionName,
    inKillZone:     activeKillZone !== null,
    killZone:       activeKillZone,
    sessions,
    nextSession,
    updatedAt:      now.toISOString(),
  }
}
