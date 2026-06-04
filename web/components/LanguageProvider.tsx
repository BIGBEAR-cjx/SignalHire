"use client";

import { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from "react";
import { DEFAULT_LOCALE, normalizeLocale, t as translate } from "@/lib/i18n.mjs";

type Locale = "zh" | "en";

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);
const STORAGE_KEY = "signalhire.locale";
const CHANGE_EVENT = "signalhire-locale-change";

function getLocaleSnapshot(): Locale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  return normalizeLocale(window.localStorage.getItem(STORAGE_KEY));
}

function subscribeLocale(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(CHANGE_EVENT, callback);
  };
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const locale = useSyncExternalStore(subscribeLocale, getLocaleSnapshot, () => DEFAULT_LOCALE) as Locale;

  useEffect(() => {
    document.documentElement.lang = locale === "en" ? "en" : "zh-CN";
  }, [locale]);

  const value = useMemo<I18nContextValue>(() => ({
    locale,
    setLocale: (next) => {
      window.localStorage.setItem(STORAGE_KEY, normalizeLocale(next));
      window.dispatchEvent(new Event(CHANGE_EVENT));
    },
    t: (key, params) => translate(locale, key, params),
  }), [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useI18n must be used inside LanguageProvider");
  return context;
}
