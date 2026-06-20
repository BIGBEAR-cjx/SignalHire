"use client";

import { type CSSProperties, useEffect, useRef, useState } from "react";
import {
  FiArrowRight,
  FiBookOpen,
  FiBriefcase,
  FiCheck,
  FiCheckCircle,
  FiCode,
  FiFileText,
  FiGithub,
  FiGlobe,
  FiLayers,
  FiMail,
  FiMic,
  FiSearch,
  FiShield,
  FiTarget,
  FiUser,
} from "react-icons/fi";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useI18n } from "@/components/LanguageProvider";
import { LogoMark } from "@/components/ui/signal-ui";

type Tone = "blue" | "green" | "amber" | "neutral";

function LandingHeading({
  i18nKey,
  zhSegments,
  className,
  style,
}: {
  i18nKey: string;
  zhSegments: string[];
  className: string;
  style?: CSSProperties;
}) {
  const { locale, t } = useI18n();
  return (
    <h2 className={className} style={style}>
      {locale === "zh" ? zhSegments.map((segment) => (
        <span key={segment} className="inline-block whitespace-nowrap">{segment}</span>
      )) : t(i18nKey)}
    </h2>
  );
}

function toneClass(tone: Tone) {
  return {
    blue: "bg-blue-50 text-blue-700 ring-blue-100",
    green: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    amber: "bg-amber-50 text-amber-800 ring-amber-100",
    neutral: "bg-neutral-50 text-neutral-700 ring-black/10",
  }[tone];
}

function SourceNetwork() {
  const { t } = useI18n();
  const sources = [
    { label: "GitHub", Icon: FiGithub },
    { label: "Google Scholar", Icon: FiBookOpen },
    { label: "arXiv", Icon: FiFileText },
    { label: "Hugging Face", Icon: FiCode },
    { label: t("landing.sources.company"), Icon: FiBriefcase },
    { label: t("landing.sources.talks"), Icon: FiMic },
    { label: t("landing.sources.personal"), Icon: FiGlobe },
  ];
  const coverage = [
    { label: t("landing.sources.research"), width: "w-[84%]" },
    { label: t("landing.sources.practice"), width: "w-[76%]" },
    { label: t("landing.sources.work"), width: "w-[69%]" },
    { label: t("landing.sources.voice"), width: "w-[58%]" },
  ];

  return (
    <div className="sh-network-card relative overflow-hidden rounded-[28px] border border-black/10 bg-white p-4 shadow-[0_26px_80px_rgba(0,0,0,0.08)]">
      <div className="grid gap-5 lg:grid-cols-[170px_34px_minmax(0,1fr)] lg:items-center">
        <div className="space-y-2">
          {sources.map(({ label, Icon }, index) => (
            <div
              key={label}
              data-sh-reveal
              className="sh-reveal sh-source-node relative flex items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2 text-xs font-medium text-[var(--sh-ink)] shadow-[0_8px_20px_rgba(0,0,0,0.04)]"
              style={{ transitionDelay: `${index * 55}ms` }}
            >
              <Icon className="h-3.5 w-3.5 text-[var(--sh-blue)]" aria-hidden="true" />
              <span className="truncate">{label}</span>
              <span
                className="sh-flow-line absolute -right-4 top-1/2 hidden h-px w-4 border-t border-dashed border-blue-300 lg:block"
                style={{ transform: `translateY(calc(-50% + ${(index - 3) * 2}px))` }}
              />
            </div>
          ))}
        </div>

        <div className="sh-search-hub mx-auto hidden h-11 w-11 items-center justify-center rounded-full bg-[var(--sh-blue)] text-white shadow-[0_16px_34px_rgba(0,113,227,0.28)] lg:flex">
          <FiSearch className="h-5 w-5" aria-hidden="true" />
        </div>

        <div data-sh-reveal className="sh-reveal sh-report-panel rounded-2xl border border-black/10 bg-white p-4" style={{ transitionDelay: "220ms" }}>
          <div className="flex items-start justify-between gap-4 border-b border-black/5 pb-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-[var(--sh-ink)]">
                <FiUser className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[var(--sh-ink)]">Jane Doe</p>
                <p className="mt-1 truncate text-xs text-[var(--sh-muted)]">{t("landing.preview.candidate1.role")}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="sh-score-pop text-4xl font-semibold tracking-tight text-[var(--sh-ink)]">92</p>
              <p className="text-xs text-[var(--sh-muted)]">{t("landing.sources.match")}</p>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {coverage.map((item) => (
              <div key={item.label} className="grid grid-cols-[86px_minmax(0,1fr)] items-center gap-3 text-xs">
                <span className="text-[var(--sh-muted)]">{item.label}</span>
                <span className="sh-evidence-meter h-2 rounded-full bg-neutral-100">
                  <span className={`sh-evidence-bar block h-2 rounded-full bg-emerald-500 ${item.width}`} />
                </span>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-xl bg-emerald-50 px-3 py-3 text-xs leading-5 text-emerald-900 ring-1 ring-emerald-100">
            <p className="font-semibold">{t("landing.sources.reportReady")}</p>
            <p className="mt-1 opacity-80">{t("landing.sources.reportDesc")}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function HeroSearch({ value, onChange, onSubmit }: { value: string; onChange: (value: string) => void; onSubmit: () => void }) {
  const { t } = useI18n();
  return (
    <form
      className="mt-7 max-w-2xl"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <div className="rounded-2xl border border-black/10 bg-white p-2 shadow-[0_14px_34px_rgba(0,0,0,0.05)]">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          placeholder={t("landing.placeholder")}
          aria-label={t("landing.inputLabel")}
          className="block min-h-[96px] w-full resize-y rounded-xl bg-neutral-50 px-3 py-3 text-[15px] leading-relaxed text-[var(--sh-ink)] outline-none placeholder:text-[var(--sh-faint)] focus:bg-white"
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3 px-1">
          <span className="text-xs text-[var(--sh-faint)]">{t("landing.inputHint", { count: value.length })}</span>
          <button type="submit" className="sh-secondary-action shrink-0 px-5">
            {t("landing.searchAction")}
            <FiArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </form>
  );
}

export default function Landing({
  onSearch,
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
  const { locale, t } = useI18n();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [q, setQ] = useState("");

  function submitSearch() {
    const value = q.trim();
    if (value) onSearch(value);
  }

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const items = Array.from(root.querySelectorAll<HTMLElement>("[data-sh-reveal]"));
    if (reduceMotion || !("IntersectionObserver" in window)) {
      items.forEach((item) => item.classList.add("sh-reveal-in"));
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("sh-reveal-in");
        observer.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -12% 0px", threshold: 0.12 });

    items.forEach((item) => observer.observe(item));
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={rootRef} className="relative overflow-hidden bg-white">
      <nav className="sticky top-3 z-30 mx-auto mt-3 flex max-w-6xl items-center justify-between rounded-full border border-black/5 bg-white/82 px-4 py-3 shadow-[0_10px_28px_rgba(0,0,0,0.05)] backdrop-blur-2xl sm:px-5">
        <a href="#top" className="flex min-w-0 items-center gap-2 font-semibold text-gray-900">
          <LogoMark className="h-8 w-8 shrink-0" />
          <span className="truncate text-[17px] tracking-tight">SignalHire</span>
        </a>
        <div className="hidden items-center gap-7 text-sm text-gray-600 md:flex">
          <a href="#reports" className="hover:text-gray-900">{t("landing.nav.reports")}</a>
          <a href="#sources" className="hover:text-gray-900">{t("landing.nav.sources")}</a>
          <a href="#judgment" className="hover:text-gray-900">{t("landing.nav.judgment")}</a>
          <a href="#outreach" className="hover:text-gray-900">{t("landing.nav.outreach")}</a>
        </div>
        {user ? (
          <div className="flex items-center gap-3 text-sm">
            <LanguageSwitcher className="max-md:hidden md:inline-flex" />
            <a
              href="/app"
              className="rounded-full bg-neutral-950 px-4 py-2 font-medium text-white transition hover:bg-neutral-800"
            >
              {t("landing.cta.enter")}
            </a>
            <button
              onClick={onLogout}
              className="rounded-full border border-black/10 px-3 py-2 font-medium text-[var(--sh-muted)] hover:border-black/20 hover:text-[var(--sh-ink)]"
            >
              {t("landing.logout")}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <LanguageSwitcher className="max-sm:hidden sm:inline-flex" />
            <button
              onClick={onLoginClick}
              className="rounded-full bg-neutral-950 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
            >
              {t("common.login")}
            </button>
          </div>
        )}
      </nav>

      <section id="top" className="relative mx-auto grid min-h-[720px] max-w-7xl items-center gap-10 px-4 pb-14 pt-10 sm:pt-12 lg:min-h-[760px] lg:grid-cols-[minmax(0,0.9fr)_minmax(520px,1.1fr)]">
        <div className="sh-fade-in-up text-left">
          <h1
            className="sh-hero-title max-w-none text-[clamp(32px,6.2vw,66px)] font-semibold leading-[1.02] text-[var(--sh-ink)]"
            style={{ whiteSpace: "nowrap" }}
          >
            {locale === "zh" ? (
              "找得准，看得清。"
            ) : (
              t("landing.title")
            )}
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--sh-muted)]">
            {t("landing.description")}
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a href="#reports" className="sh-primary-action px-6">
              {t("landing.demo")}
              <FiArrowRight className="h-4 w-4" aria-hidden="true" />
            </a>
            <button type="button" onClick={submitSearch} className="sh-secondary-action px-6">
              {t("landing.searchAction")}
            </button>
          </div>

          <HeroSearch value={q} onChange={setQ} onSubmit={submitSearch} />

          <div className="mt-6 flex flex-wrap gap-4 text-xs text-[var(--sh-muted)]">
            <span className="sh-proof-chip inline-flex items-center gap-1.5"><FiCheckCircle className="h-4 w-4 text-emerald-600" />{t("landing.hero.proof1")}</span>
            <span className="sh-proof-chip inline-flex items-center gap-1.5"><FiShield className="h-4 w-4 text-emerald-600" />{t("landing.hero.proof2")}</span>
            <span className="sh-proof-chip inline-flex items-center gap-1.5"><FiMail className="h-4 w-4 text-emerald-600" />{t("landing.hero.proof3")}</span>
          </div>
        </div>

        <SourceNetwork />
      </section>

      <SourceStrategy />
      <CandidateJudgment />
      <OutreachPreview />
      <SampleReports />
      <FinalCTA user={user} onLoginClick={onLoginClick} />
      <Footer />
    </div>
  );
}

function SourceStrategy() {
  const { t } = useI18n();
  const items = [
    { Icon: FiTarget, title: t("landing.sources.card1.title"), desc: t("landing.sources.card1.desc") },
    { Icon: FiLayers, title: t("landing.sources.card2.title"), desc: t("landing.sources.card2.desc") },
    { Icon: FiShield, title: t("landing.sources.card3.title"), desc: t("landing.sources.card3.desc") },
  ];

  return (
    <section id="sources" className="border-y border-black/5 bg-neutral-50/70 py-20">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 lg:grid-cols-[0.72fr_1fr] lg:items-center">
        <div data-sh-reveal className="sh-reveal">
          <LandingHeading
            i18nKey="landing.sources.title"
            zhSegments={["从真实工作证据", "开始找人。"]}
            className="text-3xl font-semibold leading-tight text-[var(--sh-ink)] sm:text-4xl"
          />
          <p className="mt-4 text-base leading-7 text-[var(--sh-muted)]">{t("landing.sources.desc")}</p>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {items.map(({ Icon, title, desc }, index) => (
            <article
              key={title}
              data-sh-reveal
              className="sh-reveal sh-lift-card rounded-2xl border border-black/10 bg-white p-5 shadow-[0_14px_38px_rgba(0,0,0,0.04)]"
              style={{ transitionDelay: `${index * 90}ms` }}
            >
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[var(--sh-blue)] ring-1 ring-blue-100">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="mt-4 text-base font-semibold text-[var(--sh-ink)]">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--sh-muted)]">{desc}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function CandidateJudgment() {
  const { t } = useI18n();
  const rows = [
    { claim: t("landing.judgment.row1"), github: "yes", scholar: "yes", arxiv: "partial", company: "yes", personal: "yes" },
    { claim: t("landing.judgment.row2"), github: "partial", scholar: "partial", arxiv: "weak", company: "no", personal: "partial" },
    { claim: t("landing.judgment.row3"), github: "partial", scholar: "weak", arxiv: "partial", company: "yes", personal: "yes" },
    { claim: t("landing.judgment.row4"), github: "yes", scholar: "partial", arxiv: "partial", company: "partial", personal: "no" },
  ];
  const columns = ["GitHub", "Scholar", "arXiv", t("landing.sources.company"), t("landing.sources.personal")];

  return (
    <section id="judgment" className="mx-auto grid max-w-6xl gap-10 px-4 py-20 lg:grid-cols-[0.72fr_1fr] lg:items-center">
      <div data-sh-reveal className="sh-reveal">
        <LandingHeading
          i18nKey="landing.judgment.title"
          zhSegments={["用证据对齐", "每一条关键主张。"]}
          className="text-3xl font-semibold leading-tight text-[var(--sh-ink)] sm:text-4xl"
        />
        <p className="mt-4 text-base leading-7 text-[var(--sh-muted)]">{t("landing.judgment.desc")}</p>
        <div className="mt-7 space-y-3">
          {[t("landing.judgment.point1"), t("landing.judgment.point2"), t("landing.judgment.point3")].map((point) => (
            <p key={point} className="flex items-start gap-2 text-sm leading-6 text-[var(--sh-muted)]">
              <FiCheck className="mt-1 h-4 w-4 shrink-0 text-[var(--sh-blue)]" aria-hidden="true" />
              {point}
            </p>
          ))}
        </div>
      </div>

      <div data-sh-reveal className="sh-reveal overflow-hidden rounded-2xl border border-black/10 bg-white shadow-[0_18px_52px_rgba(0,0,0,0.06)]" style={{ transitionDelay: "120ms" }}>
        <div className="grid grid-cols-[1.35fr_repeat(5,minmax(54px,1fr))] border-b border-black/5 bg-neutral-50 text-xs font-semibold text-[var(--sh-muted)]">
          <div className="px-4 py-3 text-[var(--sh-ink)]">{t("landing.judgment.claim")}</div>
          {columns.map((column) => <div key={column} className="px-2 py-3 text-center">{column}</div>)}
        </div>
        {rows.map((row, rowIndex) => (
          <div key={row.claim} className="sh-table-row grid grid-cols-[1.35fr_repeat(5,minmax(54px,1fr))] border-b border-black/5 text-xs last:border-b-0" style={{ animationDelay: `${rowIndex * 110 + 250}ms` }}>
            <div className="px-4 py-4 font-medium text-[var(--sh-ink)]">{row.claim}</div>
            {[row.github, row.scholar, row.arxiv, row.company, row.personal].map((value, index) => (
              <div key={`${row.claim}-${index}`} className="flex items-center justify-center px-2 py-4">
                <EvidenceDot value={value} />
              </div>
            ))}
          </div>
        ))}
        <div className="flex flex-wrap gap-3 px-4 py-3 text-xs text-[var(--sh-muted)]">
          <Legend value="yes" label={t("landing.judgment.legend.yes")} />
          <Legend value="partial" label={t("landing.judgment.legend.partial")} />
          <Legend value="weak" label={t("landing.judgment.legend.weak")} />
          <Legend value="no" label={t("landing.judgment.legend.no")} />
        </div>
      </div>
    </section>
  );
}

function EvidenceDot({ value }: { value: string }) {
  const className = {
    yes: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    partial: "bg-amber-50 text-amber-700 ring-amber-200",
    weak: "bg-neutral-50 text-neutral-500 ring-neutral-200",
    no: "bg-red-50 text-red-600 ring-red-100",
  }[value] ?? "bg-neutral-50 text-neutral-500 ring-neutral-200";
  const content = value === "yes" ? "✓" : value === "partial" ? "•" : value === "no" ? "×" : "–";
  return <span className={`sh-evidence-dot inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ring-1 ${className}`}>{content}</span>;
}

function Legend({ value, label }: { value: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <EvidenceDot value={value} />
      {label}
    </span>
  );
}

function OutreachPreview() {
  const { t } = useI18n();
  const angles = [
    t("landing.outreach.angle1"),
    t("landing.outreach.angle2"),
    t("landing.outreach.angle3"),
  ];

  return (
    <section id="outreach" className="border-y border-black/5 bg-neutral-50/70 py-20">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 lg:grid-cols-[0.72fr_1fr] lg:items-center">
        <div data-sh-reveal className="sh-reveal">
          <LandingHeading
            i18nKey="landing.outreach.title"
            zhSegments={["联系候选人之前，", "先知道该聊什么。"]}
            className="text-3xl font-semibold leading-tight text-[var(--sh-ink)] sm:text-4xl"
          />
          <p className="mt-4 text-base leading-7 text-[var(--sh-muted)]">{t("landing.outreach.desc")}</p>
          <div className="mt-7 space-y-3">
            {angles.map((angle) => (
              <p key={angle} className="flex items-start gap-2 text-sm leading-6 text-[var(--sh-muted)]">
                <FiCheck className="mt-1 h-4 w-4 shrink-0 text-[var(--sh-blue)]" aria-hidden="true" />
                {angle}
              </p>
            ))}
          </div>
        </div>

        <div data-sh-reveal className="sh-reveal grid gap-4 md:grid-cols-[1fr_190px]" style={{ transitionDelay: "120ms" }}>
          <div className="sh-mail-panel rounded-2xl border border-black/10 bg-white p-5 shadow-[0_18px_52px_rgba(0,0,0,0.06)]">
            <p className="text-xs font-semibold text-[var(--sh-muted)]">{t("landing.outreach.mailLabel")}</p>
            <p className="mt-3 text-sm font-semibold text-[var(--sh-ink)]">{t("landing.outreach.subject")}</p>
            <div className="mt-4 space-y-3 text-sm leading-6 text-[var(--sh-muted)]">
              <p>{t("landing.outreach.line1")}</p>
              <p>{t("landing.outreach.line2")}</p>
              <p>{t("landing.outreach.signoff")}</p>
            </div>
            <button className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--sh-blue)] px-4 py-3 text-sm font-semibold text-white">
              {t("landing.outreach.copy")}
              <FiArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <div className="sh-lift-card rounded-2xl border border-black/10 bg-white p-4 shadow-[0_18px_52px_rgba(0,0,0,0.05)]">
            <p className="text-xs font-semibold text-[var(--sh-ink)]">{t("landing.outreach.panelTitle")}</p>
            <div className="mt-4 space-y-2">
              {angles.map((angle, index) => (
                <div key={angle} className={`rounded-xl px-3 py-2 text-xs leading-5 ring-1 ${toneClass(index === 0 ? "blue" : index === 1 ? "green" : "neutral")}`}>
                  {angle}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function SampleReports() {
  const { t } = useI18n();
  const samples: { id: string; kind: "search" | "verify"; title: string; desc: string; tag: string; score: string }[] = [
    {
      id: "11e6f828-aaa7-43cd-aaad-88200b532e80",
      kind: "search",
      title: t("landing.sample1.title"),
      desc: t("landing.sample1.desc"),
      tag: t("landing.sample1.tag"),
      score: "92",
    },
    {
      id: "7db220df-f1ff-4258-b715-9a14f4505507",
      kind: "verify",
      title: t("landing.sample2.title"),
      desc: t("landing.sample2.desc"),
      tag: t("landing.sample2.tag"),
      score: "4",
    },
    {
      id: "2ed1d119-d1a7-4dd9-a26a-82236e9e4013",
      kind: "verify",
      title: t("landing.sample3.title"),
      desc: t("landing.sample3.desc"),
      tag: t("landing.sample3.tag"),
      score: "88",
    },
  ];

  return (
    <section id="reports" className="mx-auto max-w-6xl px-4 py-20">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.62fr)] lg:items-end">
        <div data-sh-reveal className="sh-reveal">
          <LandingHeading
            i18nKey="landing.samples.title"
            zhSegments={["看一次完整搜人，所见即所得。"]}
            className="text-[clamp(22px,3.2vw,40px)] font-semibold leading-tight text-[var(--sh-ink)]"
            style={{ whiteSpace: "nowrap" }}
          />
          <p className="mt-4 text-base leading-7 text-[var(--sh-muted)]">{t("landing.samples.desc")}</p>
        </div>
        <p data-sh-reveal className="sh-reveal text-sm leading-6 text-[var(--sh-muted)] lg:text-right" style={{ transitionDelay: "90ms" }}>{t("landing.samples.note")}</p>
      </div>

      <div className="mt-9 grid gap-4 md:grid-cols-3">
        {samples.map((sample, index) => (
          <a
            key={sample.id}
            href={`/r/${sample.id}`}
            target="_blank"
            rel="noreferrer"
            data-sh-reveal
            className="sh-reveal sh-sample-card group flex min-h-[280px] flex-col rounded-2xl border border-black/10 bg-white p-5 shadow-[0_18px_52px_rgba(0,0,0,0.05)] transition hover:border-black/20"
            style={{ transitionDelay: `${index * 100}ms` }}
          >
            <div className="flex items-start justify-between gap-4">
              <span className={`inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${toneClass(sample.kind === "search" ? "blue" : "amber")}`}>
                {sample.tag}
              </span>
              <span className="text-4xl font-semibold tracking-tight text-[var(--sh-ink)]">{sample.score}</span>
            </div>
            <h3 className="mt-8 text-lg font-semibold text-gray-900">{sample.title}</h3>
            <p className="mt-3 flex-1 text-sm leading-6 text-gray-600">{sample.desc}</p>
            <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-[var(--sh-blue)] group-hover:underline">
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
    <section className="border-t border-black/5 bg-white py-20">
      <div data-sh-reveal className="sh-reveal mx-auto max-w-3xl px-4 text-center">
        <LandingHeading
          i18nKey="landing.cta.title"
          zhSegments={["先看它怎么找人，", "再开始你的岗位。"]}
          className="text-3xl font-semibold leading-tight text-gray-900 sm:text-4xl"
        />
        <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-gray-600">
          {t("landing.cta.desc")}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <a href="#reports" className="sh-primary-action px-6">
            {t("landing.demo")}
            <FiArrowRight className="h-4 w-4" aria-hidden="true" />
          </a>
          {user ? (
            <a href="/app" className="sh-secondary-action px-6">{t("landing.cta.enter")}</a>
          ) : (
            <button onClick={onLoginClick} className="sh-secondary-action px-6">{t("common.login")}</button>
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
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 text-xs text-gray-500">
        <div className="flex items-center gap-2">
          <LogoMark className="h-5 w-5" />
          <span className="font-medium text-gray-700">SignalHire</span>
          <span>{t("landing.footer.tagline")}</span>
        </div>
        <div className="flex items-center gap-4">
          <span>© 2026</span>
          <a href="https://github.com/BIGBEAR-cjx/SignalHire" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-gray-900">
            <FiGithub className="h-4 w-4" aria-hidden="true" />
            GitHub
          </a>
        </div>
      </div>
    </footer>
  );
}
