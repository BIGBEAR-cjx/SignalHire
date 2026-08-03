"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { FiArrowRight, FiKey, FiLock, FiMail } from "react-icons/fi";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useI18n } from "@/components/LanguageProvider";
import { exchangePasswordResetCode, resetPassword } from "@/lib/auth";
import { LogoMark } from "@/components/ui/signal-ui";

function safeNextPath(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

function querySnapshot(key: string) {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get(key) || "";
}

export default function ResetPasswordPage() {
  const { locale, t } = useI18n();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [reset, setReset] = useState(false);
  const next = useSyncExternalStore(
    () => () => {},
    () => safeNextPath(querySnapshot("next")),
    () => "/",
  );
  const token = useSyncExternalStore(
    () => () => {},
    () => querySnapshot("token"),
    () => "",
  );
  const status = useSyncExternalStore(
    () => () => {},
    () => querySnapshot("insforge_status"),
    () => "",
  );
  const hasLinkToken = Boolean(token);
  const linkInvalid = status === "error" || (status === "ready" && !hasLinkToken);
  const loginHref = `/login?next=${encodeURIComponent(next)}`;
  const forgotHref = `/forgot-password?next=${encodeURIComponent(next)}`;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedCode = code.trim();
    if (
      newPassword.length < 6
      || newPassword !== confirmPassword
      || (!hasLinkToken && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) || !/^\d{6}$/.test(normalizedCode)))
    ) {
      setError(newPassword !== confirmPassword ? t("auth.resetPasswordMismatch") : t("auth.resetPasswordInvalid"));
      return;
    }

    setLoading(true);
    setError("");
    let resetToken = token;
    if (!resetToken) {
      const exchanged = await exchangePasswordResetCode(normalizedEmail, normalizedCode, locale);
      if (!exchanged.ok) {
        setError(exchanged.error);
        setLoading(false);
        return;
      }
      resetToken = exchanged.token;
    }

    const result = await resetPassword(newPassword, resetToken, locale);
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setReset(true);
    window.setTimeout(() => {
      window.location.href = loginHref + (loginHref.includes("?") ? "&" : "?") + "reset=success";
    }, 700);
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
              {t("auth.resetPasswordSetTitle")}
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-8 text-[var(--sh-muted)]">
              {t("auth.resetPasswordSetDesc")}
            </p>
          </div>
        </section>

        <section className="sh-surface mx-auto w-full max-w-md p-6 md:p-7">
          <div className="mb-7">
            <p className="text-sm font-medium text-[var(--sh-muted)]">{t("auth.loginPanel")}</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--sh-ink)]">{t("auth.resetPasswordSetTitle")}</h2>
          </div>

          {linkInvalid && (
            <p className="mb-4 rounded-2xl bg-red-50 px-4 py-3 text-sm leading-6 text-red-700 ring-1 ring-red-100">
              {t("auth.resetPasswordLinkInvalid")}
            </p>
          )}

          {reset ? (
            <div className="space-y-4">
              <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-700 ring-1 ring-emerald-100">
                {t("auth.resetPasswordSuccess")}
              </p>
              <Link href={loginHref} className="sh-primary-action w-full">
                {t("auth.goLogin")}
                <FiArrowRight aria-hidden="true" />
              </Link>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              {!hasLinkToken && (
                <>
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-[var(--sh-muted)]">{t("auth.resetPasswordEmailHint")}</span>
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
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-[var(--sh-muted)]">{t("auth.resetPasswordCodeHint")}</span>
                    <span className="flex items-center gap-3 rounded-2xl border border-black/10 bg-white/78 px-4 py-3 transition focus-within:border-[var(--sh-blue)] focus-within:bg-white">
                      <FiKey className="h-4 w-4 text-[var(--sh-faint)]" aria-hidden="true" />
                      <input
                        inputMode="numeric"
                        value={code}
                        onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                        placeholder={t("auth.resetPasswordCodePlaceholder")}
                        autoComplete="one-time-code"
                        className="min-w-0 flex-1 bg-transparent text-[15px] tracking-[0.22em] text-[var(--sh-ink)] outline-none placeholder:text-[var(--sh-faint)] placeholder:tracking-normal"
                      />
                    </span>
                  </label>
                </>
              )}
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-[var(--sh-muted)]">{t("auth.passwordNew")}</span>
                <span className="flex items-center gap-3 rounded-2xl border border-black/10 bg-white/78 px-4 py-3 transition focus-within:border-[var(--sh-blue)] focus-within:bg-white">
                  <FiLock className="h-4 w-4 text-[var(--sh-faint)]" aria-hidden="true" />
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    placeholder={t("auth.passwordNew")}
                    autoComplete="new-password"
                    className="min-w-0 flex-1 bg-transparent text-[15px] text-[var(--sh-ink)] outline-none placeholder:text-[var(--sh-faint)]"
                  />
                </span>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-[var(--sh-muted)]">{t("auth.resetPasswordConfirm")}</span>
                <span className="flex items-center gap-3 rounded-2xl border border-black/10 bg-white/78 px-4 py-3 transition focus-within:border-[var(--sh-blue)] focus-within:bg-white">
                  <FiLock className="h-4 w-4 text-[var(--sh-faint)]" aria-hidden="true" />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder={t("auth.resetPasswordConfirmPlaceholder")}
                    autoComplete="new-password"
                    className="min-w-0 flex-1 bg-transparent text-[15px] text-[var(--sh-ink)] outline-none placeholder:text-[var(--sh-faint)]"
                  />
                </span>
              </label>
              {error && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-100">{error}</p>}
              <button type="submit" disabled={loading || linkInvalid} className="sh-primary-action w-full disabled:pointer-events-none disabled:opacity-50">
                {loading ? t("auth.resetPasswordSubmitting") : t("auth.resetPasswordSubmit")}
                <FiArrowRight aria-hidden="true" />
              </button>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Link href={forgotHref} className="sh-secondary-action w-full">
                  {t("auth.resetPasswordSend")}
                </Link>
                <Link href={loginHref} className="sh-secondary-action w-full">
                  {t("auth.resetPasswordBackToLogin")}
                </Link>
              </div>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
