"use client";

import { useI18n } from "@/components/LanguageProvider";

type Locale = "zh" | "en";

export default function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { locale, setLocale, t } = useI18n();
  const options: Locale[] = ["zh", "en"];

  return (
    <div className={`inline-flex items-center rounded-full bg-white/80 p-1 ring-1 ring-black/10 ${className}`} aria-label={t("language.switcher")}>
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => setLocale(option)}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
            locale === option ? "bg-neutral-950 text-white" : "text-[var(--sh-muted)] hover:text-[var(--sh-ink)]"
          }`}
          aria-pressed={locale === option}
        >
          {t(`language.${option}`)}
        </button>
      ))}
    </div>
  );
}
