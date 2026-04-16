import { randomBytes } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'

type AcademyProgressRow = {
  learner_id: string
  route_id: string
  block_id: string
  best_score: number
  passed: boolean
  attempts: number
  completed_at: string | null
  updated_at: string
}

type AcademyBadgeRow = {
  id: string
  badge_code: string
  learner_id: string
  route_id: string
  route_title: string
  issued_at: string
  metadata: Record<string, unknown> | null
}

export type AcademyProgress = {
  learnerId: string
  routeId: string
  blockId: string
  bestScore: number
  passed: boolean
  attempts: number
  completedAt: string | null
  updatedAt: string
}

export type AcademyBadge = {
  id: string
  badgeCode: string
  learnerId: string
  routeId: string
  routeTitle: string
  issuedAt: string
  metadata: Record<string, unknown> | null
}

function mapProgressRow(row: AcademyProgressRow): AcademyProgress {
  return {
    learnerId: row.learner_id,
    routeId: row.route_id,
    blockId: row.block_id,
    bestScore: row.best_score,
    passed: row.passed,
    attempts: row.attempts,
    completedAt: row.completed_at,
    updatedAt: row.updated_at,
  }
}

function mapBadgeRow(row: AcademyBadgeRow): AcademyBadge {
  return {
    id: row.id,
    badgeCode: row.badge_code,
    learnerId: row.learner_id,
    routeId: row.route_id,
    routeTitle: row.route_title,
    issuedAt: row.issued_at,
    metadata: row.metadata,
  }
}

export async function listLearnerProgress(learnerId: string): Promise<AcademyProgress[]> {
  const admin = createAdminClient()
  if (!admin) return []

  const { data, error } = await admin
    .from('academy_block_progress')
    .select('*')
    .eq('learner_id', learnerId)

  if (error || !data) return []
  return (data as AcademyProgressRow[]).map(mapProgressRow)
}

export async function upsertLearnerBlockProgress(input: {
  learnerId: string
  routeId: string
  blockId: string
  score: number
  passed: boolean
}): Promise<AcademyProgress | null> {
  const admin = createAdminClient()
  if (!admin) return null

  const existing = await admin
    .from('academy_block_progress')
    .select('*')
    .eq('learner_id', input.learnerId)
    .eq('route_id', input.routeId)
    .eq('block_id', input.blockId)
    .maybeSingle()

  const existingRow = (existing.data as AcademyProgressRow | null) ?? null
  const attempts = (existingRow?.attempts ?? 0) + 1
  const bestScore = Math.max(existingRow?.best_score ?? 0, input.score)
  const passed = Boolean(existingRow?.passed || input.passed)
  const completedAt = passed ? (existingRow?.completed_at ?? new Date().toISOString()) : null

  const payload = {
    learner_id: input.learnerId,
    route_id: input.routeId,
    block_id: input.blockId,
    best_score: bestScore,
    passed,
    attempts,
    completed_at: completedAt,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await admin
    .from('academy_block_progress')
    .upsert(payload, { onConflict: 'learner_id,route_id,block_id' })
    .select('*')
    .single()

  if (error || !data) return null
  return mapProgressRow(data as AcademyProgressRow)
}

export async function listLearnerBadges(learnerId: string): Promise<AcademyBadge[]> {
  const admin = createAdminClient()
  if (!admin) return []

  const { data, error } = await admin
    .from('academy_badges')
    .select('*')
    .eq('learner_id', learnerId)
    .order('issued_at', { ascending: false })

  if (error || !data) return []
  return (data as AcademyBadgeRow[]).map(mapBadgeRow)
}

export async function findBadgeByCode(badgeCode: string): Promise<AcademyBadge | null> {
  const admin = createAdminClient()
  if (!admin) return null

  const { data, error } = await admin
    .from('academy_badges')
    .select('*')
    .eq('badge_code', badgeCode)
    .maybeSingle()

  if (error || !data) return null
  return mapBadgeRow(data as AcademyBadgeRow)
}

function buildBadgeCode(routeId: string): string {
  const suffix = randomBytes(4).toString('hex').toUpperCase()
  return `QTA-${routeId.toUpperCase()}-${suffix}`
}

export async function ensureLearnerBadge(input: {
  learnerId: string
  routeId: string
  routeTitle: string
  metadata?: Record<string, unknown>
}): Promise<AcademyBadge | null> {
  const admin = createAdminClient()
  if (!admin) return null

  const existing = await admin
    .from('academy_badges')
    .select('*')
    .eq('learner_id', input.learnerId)
    .eq('route_id', input.routeId)
    .maybeSingle()

  if (existing.data) {
    return mapBadgeRow(existing.data as AcademyBadgeRow)
  }

  const payload = {
    badge_code: buildBadgeCode(input.routeId),
    learner_id: input.learnerId,
    route_id: input.routeId,
    route_title: input.routeTitle,
    metadata: input.metadata ?? null,
  }

  const { data, error } = await admin
    .from('academy_badges')
    .insert(payload)
    .select('*')
    .single()

  if (error || !data) return null
  return mapBadgeRow(data as AcademyBadgeRow)
}
