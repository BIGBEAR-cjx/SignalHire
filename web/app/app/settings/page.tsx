"use client";

// /app/settings —— 设置(最小版)
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FiCheckCircle, FiCopy, FiLogOut } from "react-icons/fi";
import { useI18n } from "@/components/LanguageProvider";
import { logout } from "@/lib/auth";
import { PageIntro, SecondaryAction, Surface } from "@/components/ui/signal-ui";

export default function SettingsPage() {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [atsProvider, setAtsProvider] = useState<{ provider: string; enabled: boolean; reason: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // 从服务端拿 (含 user.id, 方便 SQL backfill 用)
    fetch(`/api/whoami?locale=${locale}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j?.user && setUser(j.user))
      .catch(() => {});
  }, [locale]);

  useEffect(() => {
    fetch(`/api/ats-lite/status?locale=${locale}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j?.provider && setAtsProvider(j.provider))
      .catch(() => {});
  }, [locale]);

  async function handleLogout() {
    await logout();
    router.push("/");
  }

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow={t("settings.eyebrow")}
        title={t("settings.title")}
        description={t("settings.desc")}
      />

      <Surface className="p-5 md:p-6">
        <h2 className="text-xl font-semibold text-[var(--sh-ink)]">{t("settings.account")}</h2>
        <dl className="mt-3 space-y-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-gray-500">{t("settings.email")}</dt>
            <dd className="font-medium text-gray-900">{user?.email ?? t("settings.loading")}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-gray-500">{t("settings.userId")}</dt>
            <dd className="flex items-center gap-2">
              <code className="rounded bg-gray-50 px-2 py-1 font-mono text-xs text-gray-700">
                {user?.id ?? t("settings.loading")}
              </code>
              {user?.id && (
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(user.id);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                  className="inline-flex items-center gap-1 rounded-full border border-black/10 bg-white px-2.5 py-1 text-xs font-semibold text-[var(--sh-muted)] hover:border-black/20"
                >
                  {copied ? <FiCheckCircle className="h-3.5 w-3.5" aria-hidden="true" /> : <FiCopy className="h-3.5 w-3.5" aria-hidden="true" />}
                  {copied ? t("common.copied") : t("common.copy")}
                </button>
              )}
            </dd>
          </div>
        </dl>
        <SecondaryAction onClick={handleLogout} className="mt-5">
          <FiLogOut className="h-4 w-4" aria-hidden="true" />
          {t("settings.logout")}
        </SecondaryAction>
      </Surface>

      <Surface className="p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">ATS-lite</p>
            <h2 className="mt-1 text-xl font-semibold text-[var(--sh-ink)]">Greenhouse</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--sh-muted)]">
              {locale === "en" ? "Import ATS roles and preview reviewed candidate exports." : "导入 ATS 岗位，并预览已审阅候选人的导出内容。"}
            </p>
          </div>
          <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ${
            atsProvider?.enabled ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-amber-50 text-amber-800 ring-amber-200"
          }`}>
            {atsProvider?.enabled ? "enabled" : "disabled"}
          </span>
        </div>
        <p className="mt-3 rounded-2xl bg-white/70 px-3 py-2 text-xs text-[var(--sh-muted)] ring-1 ring-black/5">
          {atsProvider?.reason ?? "Loading ATS provider status"}
        </p>
      </Surface>

      <Surface className="p-5 md:p-6">
        <h2 className="text-xl font-semibold text-[var(--sh-ink)]">{t("settings.coming")}</h2>
        <ul className="mt-4 grid gap-2 text-sm text-[var(--sh-muted)] sm:grid-cols-2">
          {["settings.password", "settings.emailPrefs", "settings.team", "settings.billing", "settings.apiKeys"].map((item) => (
            <li key={item} className="rounded-2xl bg-white/70 px-3 py-2 ring-1 ring-black/5">{t(item)}</li>
          ))}
        </ul>
      </Surface>
    </div>
  );
}
