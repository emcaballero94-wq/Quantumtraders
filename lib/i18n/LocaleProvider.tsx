'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import en from '@/messages/en.json'
import es from '@/messages/es.json'

export type Locale = 'en' | 'es'

const DICTIONARIES: Record<Locale, Record<string, any>> = { en, es }
const STORAGE_KEY = 'qt-locale'

// English is the product's source-of-truth language (terminology is decided
// in English first, Spanish is a full translation) — see LocaleProvider default.
const DEFAULT_LOCALE: Locale = 'en'

interface LocaleContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string) => string
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

function lookup(dict: Record<string, any>, key: string): string | undefined {
  return key.split('.').reduce<any>((acc, part) => (acc && typeof acc === 'object' ? acc[part] : undefined), dict)
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'en' || stored === 'es') setLocaleState(stored)
  }, [])

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
    localStorage.setItem(STORAGE_KEY, next)
  }, [])

  const t = useCallback((key: string) => {
    return lookup(DICTIONARIES[locale], key) ?? lookup(DICTIONARIES[DEFAULT_LOCALE], key) ?? key
  }, [locale])

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LocaleContext.Provider>
  )
}

export function useLocale() {
  const ctx = useContext(LocaleContext)
  if (!ctx) throw new Error('useLocale must be used within LocaleProvider')
  return ctx
}
