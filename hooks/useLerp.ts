'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Smoothly interpolates a numeric value toward its latest target every
 * animation frame — turns "the number just changed" into "the number is
 * moving", which is most of what makes a live dashboard feel alive.
 */
export function useLerp(target: number, speed = 0.12): number {
  const [display, setDisplay] = useState(target)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    function step() {
      setDisplay((prev) => {
        const diff = target - prev
        if (Math.abs(diff) < 0.01) {
          rafRef.current = null
          return target
        }
        rafRef.current = requestAnimationFrame(step)
        return prev + diff * speed
      })
    }
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(step)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [target, speed])

  return display
}
