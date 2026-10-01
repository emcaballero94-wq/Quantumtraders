const MS_PER_YEAR = 365 * 24 * 60 * 60 * 1000

// Treats expiration as end-of-day UTC — good enough for GEX purposes
// (matches the calendar date Tradier/Deribit both report), not an exact
// intraday settlement time.
export function yearsToExpiry(expirationDate: string, now: Date): number {
  const expiry = new Date(`${expirationDate}T23:59:59Z`)
  return Math.max((expiry.getTime() - now.getTime()) / MS_PER_YEAR, 0)
}
