'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Globe } from 'lucide-react';
import { Language, TranslationKey, translations } from '@/lib/translations';

interface LanguageContextType {
  language: Language;
  dir: 'rtl' | 'ltr';
  isRTL: boolean;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const STORAGE_KEY = 'chimer_preferred_language';

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>('ar');
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Language | null;
      if (saved && (saved === 'ar' || saved === 'en')) {
        setLanguageState(saved);
        document.documentElement.dir = saved === 'ar' ? 'rtl' : 'ltr';
        document.documentElement.lang = saved;
      }
    } catch {}
  }, []);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
      document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
      document.documentElement.lang = lang;
    } catch {}
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguage(language === 'ar' ? 'en' : 'ar');
  }, [language, setLanguage]);

  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string | number>): string => {
      const dict = translations[language] || translations.ar;
      let text = (dict as any)[key] || (translations.ar as any)[key] || key;
      if (params) {
        Object.entries(params).forEach(([k, v]) => {
          text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
        });
      }
      return text;
    },
    [language]
  );

  const dir = language === 'ar' ? 'rtl' : 'ltr';
  const isRTL = language === 'ar';

  return (
    <LanguageContext.Provider
      value={{
        language,
        dir,
        isRTL,
        setLanguage,
        toggleLanguage,
        t,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    // Fallback safe mock when rendered outside provider
    return {
      language: 'ar',
      dir: 'rtl',
      isRTL: true,
      setLanguage: () => {},
      toggleLanguage: () => {},
      t: (key: TranslationKey) => translations.ar[key] || key,
    };
  }
  return context;
};

/**
 * Modern, accessible Language Toggle Button
 */
export const LanguageSwitcher: React.FC<{
  className?: string;
  variant?: 'pill' | 'minimal';
}> = ({ className, variant = 'pill' }) => {
  const { language, toggleLanguage } = useLanguage();

  if (variant === 'minimal') {
    return (
      <button
        onClick={toggleLanguage}
        type="button"
        className={
          className ||
          'text-xs font-semibold text-zinc-400 hover:text-white transition-colors flex items-center gap-1.5'
        }
        title={language === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}
      >
        <Globe className="w-3.5 h-3.5 text-zinc-400" />
        <span className="font-mono">{language === 'ar' ? 'EN' : 'عربي'}</span>
      </button>
    );
  }

  return (
    <button
      onClick={toggleLanguage}
      type="button"
      className={
        className ||
        'flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] active:bg-white/[0.12] border border-white/[0.08] text-xs font-semibold text-zinc-300 hover:text-white transition-all select-none shadow-sm'
      }
      title={language === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}
    >
      <Globe className="w-3.5 h-3.5 text-emerald-400" />
      <span className="font-mono text-[11px] font-bold">
        {language === 'ar' ? 'English' : 'العربية'}
      </span>
    </button>
  );
};
