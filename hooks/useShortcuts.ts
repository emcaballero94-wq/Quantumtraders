'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export function useShortcuts() {
  const router = useRouter()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if inside an input or textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      const key = e.key.toLowerCase()

      // Simple single key shortcuts or multi-key logic
      // For multi-key like "GO", we'd need a buffer. 
      // Let's implement single key or Shift+Key for now.
      
      if (e.altKey) {
        switch (key) {
          case 'o': router.push('/dashboard/oracle'); break;
          case 'a': router.push('/dashboard/atlas'); break;
          case 'n': router.push('/dashboard/nexus'); break;
          case 'm': router.push('/dashboard/mind'); break;
          case 't': router.push('/dashboard/tools'); break;
          case 's': router.push('/settings'); break;
          case 'd': router.push('/dashboard'); break;
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [router])
}
