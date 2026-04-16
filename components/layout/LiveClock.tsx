'use client'

import { useState, useEffect } from 'react'

export function LiveClock() {
  const [time, setTime] = useState('')

  useEffect(() => {
    const update = () => {
      const now = new Date().toLocaleTimeString('en-US', {
        hour:     '2-digit',
        minute:   '2-digit',
        second:   '2-digit',
        hour12:   false,
        timeZone: 'UTC',
      })
      setTime(now + ' UTC')
    }

    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <span className="text-xs font-mono text-ink-muted tabular-nums">
      {time || '--:--:-- UTC'}
    </span>
  )
}
