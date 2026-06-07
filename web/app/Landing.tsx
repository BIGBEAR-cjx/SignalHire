"use client";

import { useState } from "react";
import {
  FiArrowRight,
  FiCheckCircle,
  FiFileText,
  FiGithub,
  FiHelpCircle,
  FiUsers,
} from "react-icons/fi";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useI18n } from "@/components/LanguageProvider";
import { LogoMark, SecondaryAction } from "@/components/ui/signal-ui";

function ReportPreview() {
  const { t } = useI18n();
  const candidates = [
    { name: "Ava Chen", role: t("landing.preview.candidate1.role"), fit: "94", tag: t("landing.preview.ready") },
    { name: "Mateo Rossi", role: t("landing.preview.candidate2.role"), fit: "89", tag: t("landing.preview.review") },
    { name: "Nora Singh", role: t("landing.preview.candidate3.role"), fit: "86", tag: t("landing.preview.ready") },
  ];
  const checks = [
    { key: "confirmed", label: t("landing.preview.confirmed"), detail: t("landing.preview.confirmedDetail"), tone: "green" },
    { key: "question", label: t("landing.preview.question"), detail: t("landing.preview.questionDetail"), tone: "amber" },
    { key: "source", label: t("landing.preview.source"), detail: t("landing.preview.sourceDetail"), tone: "blue" },
  ];

  return (
    <div className="rounded-2xl border border-black/10 bg-white p-4 text-left shadow-[0_12px_32px_rgba(0,0,0,0.06)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/5 pb-4">
        <div>
          <p className="text-sm font-semibold text-[var(--sh-ink)]">{t("landing.preview.title")}</p>
          <p className="mt-1 text-xs leading-5 text-[var(--sh-muted)]">{t("landing.preview.desc")}</p>
        </div>
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100">
          {t("landing.preview.status")}
        </span>
      </div>

      <div className="mt-4 space-y-2">
        {candidates.map((candidate) => (
          <div key={candidate.name} className="flex items-center justify-between gap-3 rounded-xl border border-black/5 bg-neutral-50 px-3 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[var(--sh-ink)]">{candidate.name}</p>
              <p className="mt-0.5 truncate text-xs text-[var(--sh-muted)]">{candidate.role}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="hidden rounded-full bg-white px-2.5 py-1 text-xs font-medium text-[var(--sh-muted)] ring-1 ring-black/10 sm:inline">
                {candidate.tag}
              </span>
              <span className="rounded-full bg-neutral-950 px-2.5 py-1 text-xs font-semibold text-white">
                {candidate.fit}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {checks.map((check) => {
          const toneClass = {
            green: "bg-emerald-50 text-emerald-800 ring-emerald-100",
            amber: "bg-amber-50 text-amber-900 ring-amber-100",
            blue: "bg-blue-50 text-blue-800 ring-blue-100",
          }[check.tone];
          return (
            <div key={check.key} className={`rounded-xl px-3 py-3 ring-1 ${toneClass}`}>
              <p className="text-xs font-semibold">{check.label}</p>
              <p className="mt-1 text-xs leading-5 opacity-80">{check.detail}</p>
            </div>
          );
        })}
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
  onSearch: (q: string) => void;
  onDemo: () => void;
  user: { email: string } | null;
  onLoginClick: () => void;
  onLogout: () => void;
}) {
  const { t } = useI18n();
  const [q, setQ] = useState("");

  return (
    <div className="relative overflow-hidden">
      <nav className="sticky top-3 z-30 mx-auto mt-3 flex max-w-5xl items-center justify-between rounded-full border border-black/5 bg-white/78 px-4 py-3 shadow-[0_10px_28px_rgba(0,0,0,0.05)] backdrop-blur-2xl sm:px-5">
        <a href="#top" className="flex min-w-0 items-center gap-2 font-semibold text-gray-900">
          <LogoMark className="h-8 w-8 shrink-0" />
          <span className="truncate text-[17px] tracking-tight">SignalHire</span>
        </a>
        <div className="hidden items-center gap-7 text-sm text-gray-600 md:flex">
          <a href="/app" className="hover:text-gray-900">{t("landing.nav.start")}</a>
          <a href="#reports" className="hover:text-gray-900">{t("landing.nav.reports")}</a>
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

      <section id="top" className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 pb-16 pt-14 lg:grid-cols-[minmax(0,1.15fr)_minmax(440px,0.85fr)] lg:pt-18">
        <div className="sh-fade-in-up max-w-3xl text-left">
          <p className="text-sm font-semibold text-[var(--sh-muted)]">{t("landing.eyebrow")}</p>
          <h1 className="mt-4 max-w-[720px] text-4xl font-semibold leading-[1.12] text-[var(--sh-ink)] sm:text-5xl lg:text-[56px]">
            {t("landing.title")}
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-[var(--sh-muted)]">
            {t("landing.description")}
          </p>

          <form
            className="relative mt-8 max-w-2xl text-left"
            onSubmit={(e) => { e.preventDefault(); const v = q.trim(); if (v) onSearch(v); }}
          >
            <div className="rounded-2xl border border-black/10 bg-white p-2 shadow-[0_12px_32px_rgba(0,0,0,0.06)]">
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
                rows={5}
                placeholder={t("landing.placeholder")}
                aria-label={t("landing.inputLabel")}
                className="block max-h-[40vh] min-h-[132px] w-full resize-y overflow-y-auto rounded-xl bg-neutral-50 px-3 py-3 text-[15px] leading-relaxed text-[var(--sh-ink)] outline-none placeholder:text-[var(--sh-faint)] focus:bg-white"
              />
              <div className="mt-2 flex flex-wrap items-center justify-between gap-3 px-1">
                <span className="text-xs text-[var(--sh-faint)]">{t("landing.inputHint", { count: q.length })}</span>
                <button type="submit" className="sh-primary-action shrink-0 px-6">
                  {t("landing.searchAction")}
                  <FiArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          </form>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <SecondaryAction onClick={onDemo}>{t("landing.demo")}</SecondaryAction>
            <span className="text-sm text-[var(--sh-muted)]">{t("landing.hero.note")}</span>
          </div>
        </div>

        <ReportPreview />
      </section>

      <WhatYouGet />
      <HowItWorks />
      <SampleReports />
      <FinalCTA user={user} onLoginClick={onLoginClick} />
      <Footer />
    </div>
  );
}

function WhatYouGet() {
  const { t } = useI18n();
  const items = [
    { Icon: FiUsers, title: t("landing.outcome.shortlist.title"), desc: t("landing.outcome.shortlist.desc") },
    { Icon: FiCheckCircle, title: t("landing.outcome.reasons.title"), desc: t("landing.outcome.reasons.desc") },
    { Icon: FiHelpCircle, title: t("landing.outcome.questions.title"), desc: t("landing.outcome.questions.desc") },
    { Icon: FiFileText, title: t("landing.outcome.sources.title"), desc: t("landing.outcome.sources.desc") },
  ];

  return (
    <section className="border-y border-black/5 bg-white/48 py-18">
      <div className="mx-auto max-w-5xl px-4">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold text-[var(--sh-muted)]">{t("landing.outcome.eyebrow")}</p>
          <h2 className="mt-2 text-3xl font-semibold leading-tight text-[var(--sh-ink)] sm:text-4xl">{t("landing.outcome.title")}</h2>
          <p className="mt-4 text-base leading-7 text-[var(--sh-muted)]">{t("landing.outcome.desc")}</p>
        </div>
        <div className="mt-9 grid gap-4 md:grid-cols-2">
          {items.map(({ Icon, title, desc }) => (
            <article key={title} className="rounded-2xl border border-black/10 bg-white p-5">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[var(--sh-blue)] ring-1 ring-blue-100">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="mt-4 text-lg font-semibold text-[var(--sh-ink)]">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--sh-muted)]">{desc}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const { t } = useI18n();
  const steps = [
    { n: "1", title: t("landing.how.step1.title"), desc: t("landing.how.step1.desc") },
    { n: "2", title: t("landing.how.step2.title"), desc: t("landing.how.step2.desc") },
    { n: "3", title: t("landing.how.step3.title"), desc: t("landing.how.step3.desc") },
  ];
  return (
    <section className="mx-auto max-w-5xl px-4 py-18">
      <div className="mb-10 text-center">
        <p className="text-sm font-semibold text-[var(--sh-muted)]">{t("landing.how.eyebrow")}</p>
        <h2 className="mt-2 text-3xl font-semibold leading-tight text-[var(--sh-ink)] sm:text-4xl">{t("landing.how.title")}</h2>
      </div>
      <ol className="grid gap-4 md:grid-cols-3">
        {steps.map((s) => (
          <li key={s.n} className="rounded-2xl border border-black/10 bg-white p-5">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-neutral-950 text-sm font-semibold text-white">
              {s.n}
            </span>
            <h3 className="mt-4 text-lg font-semibold text-[var(--sh-ink)]">{s.title}</h3>
            <p className="mt-2 text-sm leading-6 text-[var(--sh-muted)]">{s.desc}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

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
    <section id="reports" className="mx-auto max-w-5xl px-4 py-18">
      <div className="mb-10 text-center">
        <p className="text-sm font-semibold text-[var(--sh-muted)]">{t("landing.samples.eyebrow")}</p>
        <h2 className="mt-2 text-3xl font-semibold leading-tight text-gray-900 sm:text-4xl">{t("landing.samples.title")}</h2>
        <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-gray-600">{t("landing.samples.desc")}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {samples.map((s) => (
          <a
            key={s.id}
            href={`/r/${s.id}`}
            target="_blank"
            rel="noreferrer"
            className="group flex flex-col rounded-2xl border border-black/10 bg-white p-5 transition hover:-translate-y-0.5 hover:border-black/20"
          >
            <span className={`mb-3 inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${
              s.kind === "search"
                ? "bg-blue-50 text-blue-700 ring-blue-100"
                : "bg-amber-50 text-amber-900 ring-amber-100"
            }`}>
              {s.tag}
            </span>
            <h3 className="text-base font-semibold text-gray-900">{s.title}</h3>
            <p className="mt-2 flex-1 text-sm leading-6 text-gray-600">{s.desc}</p>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-gray-900 group-hover:underline">
              {t("landing.samples.open")}
              <FiArrowRight className="h-4 w-4" aria-hidden="true" />
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}

function FinalCTA({ user, onLoginClick }: { user: { email: string } | null; onLoginClick: () => void }) {
  const { t } = useI18n();
  return (
    <section className="border-t border-black/5 bg-white/55 py-18">
      <div className="mx-auto max-w-3xl px-4 text-center">
        <h2 className="text-3xl font-semibold leading-tight text-gray-900 sm:text-4xl">
          {t("landing.cta.title")}
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-gray-600">
          {t("landing.cta.desc")}
        </p>
        <div className="mt-8 flex justify-center">
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
        </div>
      </div>
    </section>
  );
}

function Footer() {
  const { t } = useI18n();
  return (
    <footer className="border-t border-gray-100 py-10">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 text-xs text-gray-500">
        <div className="flex items-center gap-2">
          <LogoMark className="h-5 w-5" />
          <span className="font-medium text-gray-700">SignalHire</span>
          <span>{t("landing.footer.tagline")}</span>
        </div>
        <div className="flex items-center gap-4">
          <a href="https://github.com/BIGBEAR-cjx/SignalHire" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-gray-900">
            <FiGithub className="h-4 w-4" aria-hidden="true" />
            GitHub
          </a>
          <span>© 2026</span>
        </div>
      </div>
    </footer>
  );
}
