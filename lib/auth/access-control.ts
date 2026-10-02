// Single-owner access gate for the public-demo phase: the live site should
// only show the marketing landing page to the general public — the actual
// dashboard (and anything that spends Anthropic/payment-provider money)
// stays restricted to the owner, independent of whatever Supabase's own
// signup settings allow. See lib/supabase/middleware.ts for where this is
// enforced.

const DEFAULT_OWNER_EMAILS = ['em.caballero94@gmail.com']

function configuredOwnerEmails(): string[] {
  const raw = process.env.OWNER_EMAILS
  if (!raw) return DEFAULT_OWNER_EMAILS
  const parsed = raw
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
  return parsed.length > 0 ? parsed : DEFAULT_OWNER_EMAILS
}

export function isOwnerEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return configuredOwnerEmails().includes(email.trim().toLowerCase())
}
