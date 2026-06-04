"use client";

// Landing.tsx —— 公开首页。
// hero 直接给搜索输入框, 缩短转化路径; 首屏展示产品真实产出形态。
import { useState } from "react";
import { FiArrowRight, FiCheckCircle, FiGithub, FiSearch, FiShield, FiUsers } from "react-icons/fi";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useI18n } from "@/components/LanguageProvider";
import { LogoMark, SecondaryAction } from "@/components/ui/signal-ui";

function ProductHeroVisual() {
  const { t } = useI18n();
  const candidates = [
    { name: "Ava Chen", role: t("landing.hero.title"), score: 94, evidence: "8 sources" },
    { name: "Mateo Rossi", role: "Inference Runtime Engineer", score: 89, evidence: "6 sources" },
    { name: "Nora Singh", role: "AI Infra Researcher", score: 86, evidence: "7 sources" },
  ];
  const sources = ["GitHub", "arXiv", "Scholar", "LinkedIn", "公司页面"];
  return (
    <div className="mx-auto mt-12 max-w-6xl text-left">
      <div className="relative overflow-hidden rounded-[34px] border border-black/10 bg-white/86 p-2 shadow-[0_28px_90px_rgba(0,0,0,0.1)] backdrop-blur-2xl">
        <div className="flex items-center justify-between rounded-t-[26px] border-b border-black/5 bg-white/78 px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-red-300" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
          </div>
          <div className="rounded-full bg-neutral-100 px-3 py-1.5 text-xs font-medium text-[var(--sh-muted)] sm:px-4">
            {t("landing.hero.workspace")}
          </div>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100">{t("landing.hero.done")}</span>
        </div>
        <div className="grid gap-0 overflow-hidden rounded-b-[26px] bg-[#f5f5f7] lg:grid-cols-[0.88fr_1.12fr]">
          <div className="border-b border-black/5 bg-white/58 p-5 lg:border-b-0 lg:border-r">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-[var(--sh-blue)] ring-1 ring-blue-100">
                <FiSearch className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--sh-faint)]">{t("landing.hero.profile")}</p>
                <h2 className="text-xl font-semibold text-[var(--sh-ink)]">{t("landing.hero.title")}</h2>
              </div>
            </div>
            <p className="mt-5 text-sm leading-6 text-[var(--sh-muted)]">
              {t("landing.hero.desc")}
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {sources.map((source) => (
                <span key={source} className="rounded-full bg-white/84 px-3 py-1.5 text-xs font-semibold text-[var(--sh-muted)] ring-1 ring-black/10">
                  {source}
                </span>
              ))}
            </div>
            <div className="mt-6 space-y-3">
              {["landing.hero.step1", "landing.hero.step2", "landing.hero.step3"].map((step, index) => (
                <div key={step} className="flex items-center gap-3 rounded-2xl bg-white/82 px-3 py-3 ring-1 ring-black/5">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-neutral-950 text-xs font-semibold text-white">{index + 1}</span>
                  <span className="text-sm font-medium text-[var(--sh-ink)]">{t(step)}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="p-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-3xl bg-white/86 p-4 ring-1 ring-black/5">
                <FiUsers className="h-5 w-5 text-[var(--sh-blue)]" aria-hidden="true" />
                <p className="mt-4 text-3xl font-semibold tracking-tight text-[var(--sh-ink)]">13</p>
                <p className="text-xs text-[var(--sh-muted)]">{t("landing.hero.metric1")}</p>
              </div>
              <div className="rounded-3xl bg-white/86 p-4 ring-1 ring-black/5">
                <FiShield className="h-5 w-5 text-emerald-600" aria-hidden="true" />
                <p className="mt-4 text-3xl font-semibold tracking-tight text-[var(--sh-ink)]">82%</p>
                <p className="text-xs text-[var(--sh-muted)]">{t("landing.hero.metric2")}</p>
              </div>
              <div className="rounded-3xl bg-white/86 p-4 ring-1 ring-black/5">
                <FiCheckCircle className="h-5 w-5 text-amber-600" aria-hidden="true" />
                <p className="mt-4 text-3xl font-semibold tracking-tight text-[var(--sh-ink)]">4</p>
                <p className="text-xs text-[var(--sh-muted)]">{t("landing.hero.metric3")}</p>
              </div>
            </div>
            <div className="mt-4 overflow-hidden rounded-3xl bg-white/90 ring-1 ring-black/5">
              {candidates.map((candidate, index) => (
                <div key={candidate.name} className="flex items-center justify-between gap-4 border-b border-black/5 px-4 py-3 last:border-0">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[var(--sh-ink)]">{candidate.name}</p>
                    <p className="mt-0.5 truncate text-xs text-[var(--sh-muted)]">{candidate.role}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="hidden text-xs text-[var(--sh-muted)] sm:inline">{candidate.evidence}</span>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      index === 0 ? "bg-neutral-950 text-white" : "bg-neutral-100 text-[var(--sh-muted)]"
                    }`}>
                      {candidate.score}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-3xl bg-neutral-950 p-5 text-white">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/50">{t("landing.hero.evidence")}</p>
              <p className="mt-3 text-lg font-semibold">{t("landing.hero.evidenceTitle")}</p>
              <p className="mt-2 text-sm leading-6 text-white/62">{t("landing.hero.evidenceDesc")}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Landing({
  onSearch,
  onDemo,
  user,
  onLoginClick,
  onLogout,
}: {
  onSearch: (q: string) => void; // hero 输入框提交 → 跑搜人
  onDemo: () => void; // "看验证示例" → 跑候选人核验示例
  user: { email: string } | null;
  onLoginClick: () => void; // 打开登录弹窗
  onLogout: () => void; // 退出
}) {
  const { t } = useI18n();
  const [q, setQ] = useState("");
  return (
    <div className="relative overflow-hidden">
      {/* 顶部浮动导航 */}
      <nav className="sticky top-3 z-30 mx-auto mt-3 flex max-w-5xl items-center justify-between rounded-full border border-black/5 bg-white/72 px-5 py-3 shadow-[0_12px_40px_rgba(0,0,0,0.06)] backdrop-blur-2xl">
        <a href="#top" className="flex items-center gap-2 font-semibold text-gray-900">
          <LogoMark className="h-8 w-8" />
          <span className="text-[17px] tracking-tight">SignalHire</span>
        </a>
        <div className="hidden items-center gap-7 text-sm text-gray-600 md:flex">
          <a href="/app" className="hover:text-gray-900">{t("landing.nav.start")}</a>
          <a href="https://github.com/BIGBEAR-cjx/SignalHire" target="_blank" rel="noreferrer" className="hover:text-gray-900">{t("landing.nav.github")}</a>
        </div>
        {user ? (
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden max-w-[160px] truncate text-gray-500 sm:inline" title={user.email}>{user.email}</span>
            <LanguageSwitcher className="hidden md:inline-flex" />
            <button
              onClick={onLogout}
              className="rounded-full border border-black/10 px-3 py-2 font-medium text-[var(--sh-muted)] hover:border-black/20 hover:text-[var(--sh-ink)]"
            >
              {t("landing.logout")}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <LanguageSwitcher className="hidden sm:inline-flex" />
            <button
              onClick={onLoginClick}
              className="rounded-full bg-neutral-950 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
            >
              {t("common.login")}
            </button>
          </div>
        )}
      </nav>

      {/* Hero */}
      <section id="top" className="relative mx-auto max-w-6xl px-4 pb-16 pt-16 text-center">
        {/* 中央内容 */}
        <div className="sh-fade-in-up relative z-10 mx-auto max-w-3xl">
          <p className="text-sm font-semibold text-[var(--sh-muted)]">{t("landing.eyebrow")}</p>
          <h1 className="mt-4 text-5xl font-semibold leading-[1.04] text-[var(--sh-ink)] sm:text-7xl">
            {t("landing.title")}
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-[var(--sh-muted)]">
            {t("landing.description")}
          </p>

          {/* 直接搜索输入框 (缩短转化路径; 多行大框, 完整看到长输入) */}
          <form
            className="relative mx-auto mt-9 max-w-2xl text-left"
            onSubmit={(e) => { e.preventDefault(); const v = q.trim(); if (v) onSearch(v); }}
          >
            <div className="sh-surface p-2.5">
              <textarea
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                    e.preventDefault();
                    const v = q.trim();
                    if (v) onSearch(v);
                  }
                }}
                rows={6}
                placeholder={t("landing.placeholder")}
                aria-label={t("landing.inputLabel")}
                className="block max-h-[40vh] min-h-[150px] w-full resize-y overflow-y-auto rounded-[18px] bg-white/70 px-3 py-2.5 text-[15px] leading-relaxed text-[var(--sh-ink)] outline-none placeholder:text-[var(--sh-faint)]"
              />
              <div className="mt-1 flex items-center justify-between gap-2 px-1">
                <span className="text-xs text-[var(--sh-faint)]">{t("landing.inputCount", { count: q.length })}</span>
                <button type="submit" className="sh-primary-action shrink-0 px-6">
                  {t("common.search")}
                </button>
              </div>
            </div>
          </form>
          <div className="mt-4 flex justify-center">
            <SecondaryAction onClick={onDemo}>{t("landing.demo")}</SecondaryAction>
          </div>
        </div>
        <ProductHeroVisual />
      </section>

      <HowItWorks />
      <WhyDifferent />
      <SampleReports />
      <FinalCTA user={user} onLoginClick={onLoginClick} />
      <Footer />
    </div>
  );
}

// ───────── 如何工作 (3 步) ─────────
function HowItWorks() {
  const { t } = useI18n();
  const steps = [
    {
      n: "1",
      title: t("landing.how.step1.title"),
      desc: t("landing.how.step1.desc"),
    },
    {
      n: "2",
      title: t("landing.how.step2.title"),
      desc: t("landing.how.step2.desc"),
    },
    {
      n: "3",
      title: t("landing.how.step3.title"),
      desc: t("landing.how.step3.desc"),
    },
  ];
  return (
    <section className="mx-auto max-w-5xl px-4 py-20">
      <div className="mb-12 text-center">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">{t("landing.how.eyebrow")}</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--sh-ink)] sm:text-4xl">{t("landing.how.title")}</h2>
      </div>
      <ol className="grid gap-6 md:grid-cols-3">
        {steps.map((s) => (
          <li key={s.n} className="relative rounded-[28px] border border-black/10 bg-white/84 p-6 shadow-[0_18px_52px_rgba(0,0,0,0.06)]">
            <span className="absolute -top-4 left-6 inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--sh-ink)] text-sm font-semibold text-white shadow-sm">
              {s.n}
            </span>
            <h3 className="mt-2 text-lg font-semibold text-[var(--sh-ink)]">{s.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-[var(--sh-muted)]">{s.desc}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

// ───────── 差异化对比 ─────────
function WhyDifferent() {
  const { t } = useI18n();
  const rows: { label: string; linkedin: string; recruiter: string; signalhire: string; signalhireHi?: boolean }[] = [
    { label: t("landing.diff.row1.label"), linkedin: t("landing.diff.row1.linkedin"), recruiter: t("landing.diff.row1.recruiter"), signalhire: t("landing.diff.row1.signalhire") },
    { label: t("landing.diff.row2.label"), linkedin: t("landing.diff.row2.linkedin"), recruiter: t("landing.diff.row2.recruiter"), signalhire: t("landing.diff.row2.signalhire"), signalhireHi: true },
    { label: t("landing.diff.row3.label"), linkedin: t("landing.diff.row3.linkedin"), recruiter: t("landing.diff.row3.recruiter"), signalhire: t("landing.diff.row3.signalhire") },
    { label: t("landing.diff.row4.label"), linkedin: t("landing.diff.row4.linkedin"), recruiter: t("landing.diff.row4.recruiter"), signalhire: t("landing.diff.row4.signalhire") },
    { label: t("landing.diff.row5.label"), linkedin: t("landing.diff.row5.linkedin"), recruiter: t("landing.diff.row5.recruiter"), signalhire: t("landing.diff.row5.signalhire"), signalhireHi: true },
  ];
  return (
    <section className="border-y border-black/5 bg-white/45 py-20">
      <div className="mx-auto max-w-5xl px-4">
        <div className="mb-12 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">{t("landing.diff.eyebrow")}</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--sh-ink)] sm:text-4xl">{t("landing.diff.title")}</h2>
          <p className="mx-auto mt-4 max-w-2xl text-base text-gray-600">
            {t("landing.diff.desc")}
          </p>
        </div>
        <div className="overflow-hidden rounded-[28px] border border-black/10 bg-white/86 shadow-[0_18px_52px_rgba(0,0,0,0.06)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50 text-left">
                <th className="px-4 py-3 font-medium text-gray-500">{t("landing.diff.dimension")}</th>
                <th className="px-4 py-3 font-medium text-gray-500">{t("landing.diff.linkedin")}</th>
                <th className="px-4 py-3 font-medium text-gray-500">{t("landing.diff.recruiter")}</th>
                <th className="px-4 py-3 font-medium text-gray-900">SignalHire</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-3 font-medium text-gray-700">{r.label}</td>
                  <td className="px-4 py-3 text-gray-600">{r.linkedin}</td>
                  <td className="px-4 py-3 text-gray-600">{r.recruiter}</td>
                  <td className={`px-4 py-3 ${r.signalhireHi ? "font-semibold text-gray-900" : "text-gray-800"}`}>
                    {r.signalhireHi && <FiCheckCircle className="mr-1 inline h-4 w-4 text-emerald-600" aria-hidden="true" />}
                    {r.signalhire}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

// ───────── 示例报告 (公开 /r/[id]) ─────────
function SampleReports() {
  const { t } = useI18n();
  const samples: { id: string; kind: "search" | "verify"; title: string; desc: string; tag: string }[] = [
    {
      id: "11e6f828-aaa7-43cd-aaad-88200b532e80",
      kind: "search",
      title: t("landing.sample1.title"),
      desc: t("landing.sample1.desc"),
      tag: t("landing.sample1.tag"),
    },
    {
      id: "7db220df-f1ff-4258-b715-9a14f4505507",
      kind: "verify",
      title: t("landing.sample2.title"),
      desc: t("landing.sample2.desc"),
      tag: t("landing.sample2.tag"),
    },
    {
      id: "2ed1d119-d1a7-4dd9-a26a-82236e9e4013",
      kind: "verify",
      title: t("landing.sample3.title"),
      desc: t("landing.sample3.desc"),
      tag: t("landing.sample3.tag"),
    },
  ];
  return (
    <section className="mx-auto max-w-5xl px-4 py-20">
      <div className="mb-12 text-center">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">{t("landing.samples.eyebrow")}</p>
        <h2 className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">{t("landing.samples.title")}</h2>
        <p className="mx-auto mt-4 max-w-xl text-base text-gray-600">{t("landing.samples.desc")}</p>
      </div>
      <div className="grid gap-5 md:grid-cols-3">
        {samples.map((s) => (
          <a
            key={s.id}
            href={`/r/${s.id}`}
            target="_blank"
            rel="noreferrer"
            className="group flex flex-col rounded-[28px] border border-black/10 bg-white/86 p-5 shadow-[0_18px_52px_rgba(0,0,0,0.06)] transition hover:-translate-y-0.5 hover:border-black/20 hover:shadow-[0_24px_68px_rgba(0,0,0,0.1)]"
          >
            <span className={`mb-3 inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${
              s.kind === "search"
                ? "bg-blue-50 text-blue-700 ring-blue-100"
                : "bg-amber-50 text-amber-800 ring-amber-100"
            }`}>
              {s.tag}
            </span>
            <h3 className="text-base font-semibold text-gray-900">{s.title}</h3>
            <p className="mt-1 flex-1 text-sm leading-relaxed text-gray-600">{s.desc}</p>
            <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-gray-900 group-hover:underline">
              {t("landing.samples.open")}
              <FiArrowRight className="h-4 w-4" aria-hidden="true" />
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}

// ───────── 末位 CTA ─────────
function FinalCTA({ user, onLoginClick }: { user: { email: string } | null; onLoginClick: () => void }) {
  const { t } = useI18n();
  return (
    <section className="border-t border-black/5 bg-white/55 py-20">
      <div className="mx-auto max-w-3xl px-4 text-center">
        <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
          {t("landing.cta.title")}
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base text-gray-600">
          {t("landing.cta.desc")}
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {user ? (
            <a href="/app" className="sh-primary-action px-6">
              {t("landing.cta.enter")}
              <FiArrowRight className="h-4 w-4" aria-hidden="true" />
            </a>
          ) : (
            <button onClick={onLoginClick} className="sh-primary-action px-6">
              {t("landing.cta.trial")}
              <FiArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
          <a href="https://github.com/BIGBEAR-cjx/SignalHire" target="_blank" rel="noreferrer" className="sh-secondary-action px-6">
            <FiGithub className="h-4 w-4" aria-hidden="true" />
            {t("landing.cta.github")}
          </a>
        </div>
      </div>
    </section>
  );
}

// ───────── Footer ─────────
function Footer() {
  const { t } = useI18n();
  return (
    <footer className="border-t border-gray-100 py-10">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 text-xs text-gray-500">
        <div className="flex items-center gap-2">
          <LogoMark className="h-5 w-5" />
          <span className="font-medium text-gray-700">SignalHire</span>
          <span>· {t("landing.footer.tagline")}</span>
        </div>
        <div className="flex items-center gap-4">
          <a href="https://github.com/BIGBEAR-cjx/SignalHire" target="_blank" rel="noreferrer" className="hover:text-gray-900">GitHub</a>
          <span>© 2026</span>
        </div>
      </div>
    </footer>
  );
}
