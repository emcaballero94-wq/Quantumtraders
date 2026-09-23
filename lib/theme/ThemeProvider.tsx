'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export type Palette = 'gold' | 'blue'
export type Typeface = 'display' | 'sans'

const STORAGE_KEY = 'qt-theme'
const DEFAULTS: { palette: Palette; typeface: Typeface } = { palette: 'gold', typeface: 'display' }

interface ThemeContextValue {
  palette: Palette
  typeface: Typeface
  setPalette: (p: Palette) => void
  setTypeface: (t: Typeface) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function apply(palette: Palette, typeface: Typeface) {
  const root = document.documentElement
  root.setAttribute('data-theme', palette)
  root.setAttribute('data-typeface', typeface)
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [palette, setPaletteState] = useState<Palette>(DEFAULTS.palette)
  const [typeface, setTypefaceState] = useState<Typeface>(DEFAULTS.typeface)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const saved = JSON.parse(raw)
        if (saved.palette === 'gold' || saved.palette === 'blue') setPaletteState(saved.palette)
        if (saved.typeface === 'display' || saved.typeface === 'sans') setTypefaceState(saved.typeface)
      }
    } catch {
      // ignore corrupted local storage
    }
  }, [])

  useEffect(() => {
    apply(palette, typeface)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ palette, typeface }))
    } catch {
      // storage unavailable (private mode, quota) — theme just won't persist
    }
  }, [palette, typeface])

  return (
    <ThemeContext.Provider
      value={{ palette, typeface, setPalette: setPaletteState, setTypeface: setTypefaceState }}
    >
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider')
  return ctx
}

/** Inline, blocking script string — read localStorage and set the theme
 * attributes before first paint so there's no flash of the default theme. */
export const THEME_NO_FLASH_SCRIPT = `
(function () {
  try {
    var raw = localStorage.getItem('${STORAGE_KEY}');
    var saved = raw ? JSON.parse(raw) : {};
    var palette = saved.palette === 'blue' ? 'blue' : 'gold';
    var typeface = saved.typeface === 'sans' ? 'sans' : 'display';
    var root = document.documentElement;
    root.setAttribute('data-theme', palette);
    root.setAttribute('data-typeface', typeface);
  } catch (e) {}
})();
`
