'use client'

import { useRef, useCallback } from 'react'

/**
 * Subtle pointer-driven 3D tilt for card surfaces — a few degrees max,
 * enough to read as "premium depth" without feeling like a game HUD.
 */
export function useTilt(maxDeg = 4) {
  const ref = useRef<HTMLDivElement>(null)

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const px = (e.clientX - rect.left) / rect.width - 0.5
    const py = (e.clientY - rect.top) / rect.height - 0.5
    el.style.transform = `perspective(800px) rotateX(${(-py * maxDeg).toFixed(2)}deg) rotateY(${(px * maxDeg).toFixed(2)}deg) translateZ(0)`
  }, [maxDeg])

  const onMouseLeave = useCallback(() => {
    const el = ref.current
    if (!el) return
    el.style.transform = 'perspective(800px) rotateX(0deg) rotateY(0deg) translateZ(0)'
  }, [])

  return { ref, onMouseMove, onMouseLeave }
}
