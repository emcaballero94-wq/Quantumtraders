// Reads a Quantum Traders theme color token straight from the CSS variables
// already defined in app/globals.css (the same ones Tailwind's `rgb(var(--c-x)
// / <alpha>)` pattern uses). This is how Quantum City stays color-consistent
// with the rest of the app instead of hardcoding a second copy of the
// palette that could drift from the real theme.

export function readCssColorVar(varName: string, fallback: [number, number, number] = [136, 136, 136]): [number, number, number] {
  if (typeof window === 'undefined') return fallback
  const raw = getComputedStyle(document.documentElement).getPropertyValue(varName).trim()
  if (!raw) return fallback
  const parts = raw.split(/\s+/).map(Number)
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return fallback
  return parts as [number, number, number]
}

export function rgbTupleToHex([r, g, b]: [number, number, number]): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)))
  return `#${[r, g, b].map((n) => clamp(n).toString(16).padStart(2, '0')).join('')}`
}
