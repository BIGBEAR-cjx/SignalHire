"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { FiArrowRight, FiCheckCircle, FiMail } from "react-icons/fi";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useI18n } from "@/components/LanguageProvider";
import { sendPasswordResetEmail } from "@/lib/auth";
import { LogoMark } from "@/components/ui/signal-ui";

function safeNextPath(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

function querySnapshot(key: string) {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get(key) || "";
}

export default function ForgotPasswordPage() {
  const { locale, t } = useI18n();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const next = useSyncExternalStore(
    () => () => {},
    () => safeNextPath(querySnapshot("next")),
    () => "/",
  );

  const loginHref = `/login?next=${encodeURIComponent(next)}`;
  const resetCodeHref = `/reset-password?next=${encodeURIComponent(next)}`;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError(t("auth.resetPasswordInvalid"));
      return;
    }
    setLoading(true);
    setError("");
    const result = await sendPasswordResetEmail(normalizedEmail, next, locale);
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSent(true);
  }

  return (
    <main className="min-h-screen px-5 py-6 md:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-6xl flex-col justify-center gap-8 lg:grid lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <section className="space-y-8">
          <Link href="/" className="inline-flex items-center gap-2 text-[15px] font-semibold text-[var(--sh-ink)]">
            <LogoMark className="h-8 w-8" />
            SignalHire
          </Link>
          <LanguageSwitcher />
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--sh-faint)]">{t("auth.intel")}</p>
            <h1 className="mt-3 text-5xl font-semibold leading-[1.02] tracking-tight text-[var(--sh-ink)] md:text-6xl">
              {t("auth.resetPasswordHero")}
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-8 text-[var(--sh-muted)]">
              {t("auth.resetPasswordDesc")}
            </p>
          </div>
        </section>

        <section className="sh-surface mx-auto w-full max-w-md p-6 md:p-7">
          <div className="mb-7">
            <p className="text-sm font-medium text-[var(--sh-muted)]">{t("auth.loginPanel")}</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--sh-ink)]">{t("auth.resetPasswordTitle")}</h2>
          </div>

          {sent ? (
            <div className="space-y-4">
              <p className="flex items-start gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-700 ring-1 ring-emerald-100">
                <FiCheckCircle className="mt-1 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{t("auth.resetPasswordSent")}</span>
              </p>
              <Link href={resetCodeHref} className="sh-secondary-action w-full">
                {t("auth.resetPasswordUseCode")}
                <FiArrowRight aria-hidden="true" />
              </Link>
              <Link href={loginHref} className="sh-secondary-action w-full">
                {t("auth.resetPasswordBackToLogin")}
              </Link>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-[var(--sh-muted)]">{t("auth.email")}</span>
                <span className="flex items-center gap-3 rounded-2xl border border-black/10 bg-white/78 px-4 py-3 transition focus-within:border-[var(--sh-blue)] focus-within:bg-white">
                  <FiMail className="h-4 w-4 text-[var(--sh-faint)]" aria-hidden="true" />
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@company.com"
                    autoComplete="email"
                    className="min-w-0 flex-1 bg-transparent text-[15px] text-[var(--sh-ink)] outline-none placeholder:text-[var(--sh-faint)]"
                  />
                </span>
              </label>
              {error && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-100">{error}</p>}
              <button type="submit" disabled={loading} className="sh-primary-action w-full disabled:pointer-events-none disabled:opacity-50">
                {loading ? t("auth.resetPasswordSending") : t("auth.resetPasswordSend")}
                <FiArrowRight aria-hidden="true" />
              </button>
              <Link href={loginHref} className="sh-secondary-action w-full">
                {t("auth.resetPasswordBackToLogin")}
              </Link>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
