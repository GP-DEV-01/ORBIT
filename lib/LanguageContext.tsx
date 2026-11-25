'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { Language, t as translate } from './i18n'

interface LangCtx {
  lang: Language
  setLang: (l: Language) => void
  t: (key: string) => string
}

const Ctx = createContext<LangCtx>({ lang: 'EN', setLang: () => {}, t: k => k })

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>('EN')

  useEffect(() => {
    const saved = localStorage.getItem('orbit-lang') as Language | null
    if (saved) setLangState(saved)
  }, [])

  function setLang(l: Language) {
    setLangState(l)
    localStorage.setItem('orbit-lang', l)
  }

  return (
    <Ctx.Provider value={{ lang, setLang, t: (k) => translate(lang, k) }}>
      {children}
    </Ctx.Provider>
  )
}

export const useLang = () => useContext(Ctx)
