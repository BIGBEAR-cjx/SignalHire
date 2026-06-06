"use client";

// 控制台总览 (Phase 1.4)
// 4 KPI + 进行中任务 + 最近研究; 顶部 + 新建。
import { useEffect, useState } from "react";
import Link from "next/link";
import type { IconType } from "react-icons";
import { FiAlertTriangle, FiBriefcase, FiCheckCircle, FiClipboard } from "react-icons/fi";
import { useI18n } from "@/components/LanguageProvider";
import {
  EmptyState,
  FiPlus,
  FiSearch,
  LoadingState,
  MetricCard,
  PageIntro,
  PrimaryAction,
  SecondaryAction,
  Surface,
} from "@/components/ui/signal-ui";

interface Kpi {
  searches_this_month: number;
  verifies_total: number;
  shortlist_total: number;
  red_flags_total: number;
  projects_open: number;
}
interface ActiveJob {
  id: string;
  kind: "search" | "verify";
  label: string;
  status: string;
  updated_at: string | null;
}
interface RecentRun {
  kind: "search" | "verify";
  label: string;
  summary: string;
  query_text: string;
  updated_at: string;
}
interface ActiveProject {
  id: string;
  name: string;
  brief: string | null;
  candidates_total: number;
  candidates_active: number;
  runs_active: number;
}
interface OverviewData {
  kpi: Kpi;
  active_jobs: ActiveJob[];
  recent: RecentRun[];
  active_projects: ActiveProject[];
}

const KPI_CONFIG: { key: keyof Kpi; labelKey: string; subKey: string; tone: "neutral" | "blue" | "green" | "amber"; Icon: IconType }[] = [
  { key: "projects_open", labelKey: "overview.projectsOpen", subKey: "overview.unitProjects", tone: "blue", Icon: FiBriefcase },
  { key: "searches_this_month", labelKey: "overview.searchesMonth", subKey: "overview.unitResearch", tone: "neutral", Icon: FiSearch },
  { key: "verifies_total", labelKey: "overview.verifiesTotal", subKey: "overview.unitReports", tone: "amber", Icon: FiCheckCircle },
  { key: "shortlist_total", labelKey: "overview.shortlistTotal", subKey: "overview.unitPeople", tone: "green", Icon: FiClipboard },
  { key: "red_flags_total", labelKey: "overview.redFlags", subKey: "overview.unitFlags", tone: "amber", Icon: FiAlertTriangle },
];

function KindBadge({ kind }: { kind: "search" | "verify" }) {
  const { t } = useI18n();
  if (kind === "search") return <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">{t("kind.search")}</span>;
  return <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">{t("kind.verify")}</span>;
}

function StatusDot({ status }: { status: string }) {
  const { t } = useI18n();
  const color =
    status === "running" ? "bg-blue-500" :
    status === "retrying" ? "bg-amber-500" :
    "bg-gray-400";
  const label =
    status === "running" ? t("status.running") :
    status === "retrying" ? t("status.retrying") :
    t("status.queued");
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
      <span className={`h-1.5 w-1.5 animate-pulse rounded-full ${color}`} />
      {label}
    </span>
  );
}

export default function Overview() {
  const { locale, t } = useI18n();
  const [data, setData] = useState<OverviewData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/overview?locale=${locale}`)
      .then(async (r) => {
        if (r.ok) return r.json();
        if (r.status === 401) throw new Error("__SESSION_EXPIRED__");
        throw new Error(`HTTP ${r.status}`);
      })
      .then(setData)
      .catch((e) => setError((e as Error).message));
  }, [locale]);

  // 进行中任务实时性: 有 active jobs 时, 每 5s 轻量重新拉一次 (用户不会一直盯着, 但回来时数字是新的)
  useEffect(() => {
    if (!data?.active_jobs?.length) return;
    const t = setInterval(() => {
      fetch(`/api/overview?locale=${locale}`).then((r) => r.ok ? r.json() : null).then((j) => j && setData(j)).catch(() => {});
    }, 5000);
    return () => clearInterval(t);
  }, [data?.active_jobs?.length, locale]);

  const empty = data && data.kpi.searches_this_month === 0 && data.kpi.verifies_total === 0 && data.kpi.shortlist_total === 0;

  return (
    <div className="space-y-8">
      <PageIntro
        eyebrow={t("overview.eyebrow")}
        title={t("overview.title")}
        description={t("overview.desc")}
        actions={
          <>
            <PrimaryAction href="/app/search"><FiSearch className="h-4 w-4" aria-hidden="true" /> {t("nav.search")}</PrimaryAction>
            <SecondaryAction href="/app/projects"><FiPlus className="h-4 w-4" aria-hidden="true" /> {t("overview.newProject")}</SecondaryAction>
          </>
        }
      />

      {error === "__SESSION_EXPIRED__" ? (
        <div className="rounded-xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-800">
          <p>{t("overview.sessionExpired")}</p>
          <button
            onClick={async () => {
              const { logout } = await import("@/lib/auth");
              await logout();
              location.href = "/";
            }}
            className="mt-2 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700"
          >
            {t("common.retryLogin")}
          </button>
        </div>
      ) : error ? (
        <p className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">{t("common.errorPrefix")}: {error}</p>
      ) : null}

      {/* KPI 卡 */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {KPI_CONFIG.map((cfg) => (
          <MetricCard
            key={cfg.key}
            label={t(cfg.labelKey)}
            value={data ? data.kpi[cfg.key] : "—"}
            sub={t(cfg.subKey)}
            Icon={cfg.Icon}
            tone={cfg.tone}
          />
        ))}
      </section>

      {/* 进行中招聘项目 */}
      {data && data.active_projects.length > 0 && (
        <Surface className="p-5">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">{t("overview.continueProjects")}</p>
              <h2 className="mt-1 text-xl font-semibold text-[var(--sh-ink)]">{t("overview.activeProjects")}</h2>
            </div>
            <Link href="/app/projects" className="text-sm font-medium text-blue-600 hover:text-blue-700">{t("overview.viewAll")}</Link>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {data.active_projects.map((p) => (
              <Link
                key={p.id}
                href={`/app/projects/${p.id}`}
                className="group rounded-2xl bg-white/80 p-4 ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:bg-white"
              >
                <p className="line-clamp-2 text-sm font-semibold text-[var(--sh-ink)]">{p.name}</p>
                {p.brief && <p className="mt-2 line-clamp-2 text-xs leading-5 text-[var(--sh-muted)]">{p.brief}</p>}
                <div className="mt-4 flex flex-wrap items-center gap-1.5 text-xs text-[var(--sh-muted)]">
                  <span className="rounded-full bg-neutral-100 px-2 py-0.5">{p.candidates_total} {t("overview.candidates")}</span>
                  {p.runs_active > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-amber-800">
                      <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
                      {p.runs_active} {t("overview.researching")}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </Surface>
      )}

      {/* 进行中任务 + 最近研究 */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* 进行中 */}
        <Surface className="p-5">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">{t("overview.active")}</p>
              <h2 className="mt-1 text-xl font-semibold text-[var(--sh-ink)]">{t("overview.activeTasks")}</h2>
            </div>
            {data && data.active_jobs.length > 0 && (
              <span className="rounded-full bg-white/80 px-2.5 py-1 text-xs text-[var(--sh-muted)] ring-1 ring-black/5">{data.active_jobs.length} {t("overview.unitProjects")}</span>
            )}
          </div>
          {!data && <LoadingState title={t("overview.syncTasks")} description={t("overview.syncTasksDesc")} className="mt-5" />}
          {data && data.active_jobs.length === 0 && (
            <div className="mt-5 rounded-2xl border border-dashed border-black/10 bg-white/60 p-5 text-center text-sm text-[var(--sh-muted)]">
              {t("overview.noActiveTasks")}
            </div>
          )}
          {data && data.active_jobs.length > 0 && (
            <ul className="mt-5 space-y-2">
              {data.active_jobs.map((j) => (
                <li key={j.id} className="flex items-start justify-between gap-3 rounded-2xl bg-white/80 p-3.5 ring-1 ring-black/5">
                  <span className="flex min-w-0 flex-1 items-start gap-2">
                    <KindBadge kind={j.kind} />
                    <span className="min-w-0 truncate text-sm text-[var(--sh-ink)]" title={j.label}>{j.label}</span>
                  </span>
                  <StatusDot status={j.status} />
                </li>
              ))}
            </ul>
          )}
        </Surface>

        {/* 最近研究 */}
        <Surface className="p-5">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">{t("overview.recentSignal")}</p>
              <h2 className="mt-1 text-xl font-semibold text-[var(--sh-ink)]">{t("overview.recentResearch")}</h2>
            </div>
            <Link href="/app/history" className="text-sm font-medium text-blue-600 hover:text-blue-700">{t("overview.viewAll")}</Link>
          </div>
          {!data && <LoadingState title={t("overview.loadRecent")} description={t("overview.loadRecentDesc")} className="mt-5" />}
          {data && data.recent.length === 0 && (
            <div className="mt-5 rounded-2xl border border-dashed border-black/10 bg-white/60 p-5 text-center text-sm text-[var(--sh-muted)]">
              {t("overview.noRecent")}
            </div>
          )}
          {data && data.recent.length > 0 && (
            <ul className="mt-5 space-y-2">
              {data.recent.map((r, i) => {
                const target = r.kind === "search"
                  ? `/app/search?q=${encodeURIComponent(r.query_text)}`
                  : `/app/verify?bio=${encodeURIComponent(r.query_text)}`;
                return (
                  <li key={i}>
                    <Link href={target} className="flex items-start justify-between gap-3 rounded-2xl bg-white/80 p-3.5 ring-1 ring-black/5 transition hover:bg-white">
                      <span className="flex min-w-0 flex-1 items-start gap-2">
                        <KindBadge kind={r.kind} />
                        <span className="min-w-0 truncate text-sm text-[var(--sh-ink)]" title={r.query_text}>{r.label}</span>
                      </span>
                      <span className="shrink-0 text-xs text-[var(--sh-faint)]">{r.summary}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Surface>
      </div>

      {/* 空状态 onboarding */}
      {empty && (
        <EmptyState
          title={t("overview.emptyTitle")}
          description={t("overview.emptyDesc")}
          action={<PrimaryAction href="/app/search">{t("overview.emptyAction")}</PrimaryAction>}
        />
      )}
    </div>
  );
}
