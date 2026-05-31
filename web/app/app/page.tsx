"use client";

// 控制台总览 (Phase 1.4)
// 4 KPI + 进行中任务 + 最近研究; 顶部 + 新建。
import { useEffect, useState } from "react";
import Link from "next/link";

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

const KPI_CONFIG: { key: keyof Kpi; label: string; sub: string; accent: string; icon: string }[] = [
  { key: "projects_open",       label: "进行中项目",     sub: "个",          accent: "from-blue-100/60",     icon: "📁" },
  { key: "searches_this_month", label: "本月搜人",       sub: "次研究",      accent: "from-sky-100/60",      icon: "🔍" },
  { key: "verifies_total",      label: "已核验候选人",   sub: "份报告",      accent: "from-amber-100/60",    icon: "✅" },
  { key: "shortlist_total",     label: "候选池",         sub: "人",          accent: "from-emerald-100/60",  icon: "📋" },
  { key: "red_flags_total",     label: "红旗",           sub: "个 (打脸)",   accent: "from-rose-100/60",     icon: "🚩" },
];

function KindBadge({ kind }: { kind: "search" | "verify" }) {
  if (kind === "search") return <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">搜人</span>;
  return <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">核验</span>;
}

function StatusDot({ status }: { status: string }) {
  const color =
    status === "running" ? "bg-blue-500" :
    status === "retrying" ? "bg-amber-500" :
    "bg-gray-400";
  const label =
    status === "running" ? "运行中" :
    status === "retrying" ? "重试中" :
    "排队中";
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
      <span className={`h-1.5 w-1.5 animate-pulse rounded-full ${color}`} />
      {label}
    </span>
  );
}

export default function Overview() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/overview")
      .then(async (r) => {
        if (r.ok) return r.json();
        if (r.status === 401) throw new Error("__SESSION_EXPIRED__");
        throw new Error(`HTTP ${r.status}`);
      })
      .then(setData)
      .catch((e) => setError((e as Error).message));
  }, []);

  // 进行中任务实时性: 有 active jobs 时, 每 5s 轻量重新拉一次 (用户不会一直盯着, 但回来时数字是新的)
  useEffect(() => {
    if (!data?.active_jobs?.length) return;
    const t = setInterval(() => {
      fetch("/api/overview").then((r) => r.ok ? r.json() : null).then((j) => j && setData(j)).catch(() => {});
    }, 5000);
    return () => clearInterval(t);
  }, [data?.active_jobs?.length]);

  const empty = data && data.kpi.searches_this_month === 0 && data.kpi.verifies_total === 0 && data.kpi.shortlist_total === 0;

  return (
    <div className="space-y-8">
      {/* 顶部 hero */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">总览</h1>
          <p className="mt-1 text-sm text-gray-500">你的招聘工作台。从这里开始一次新研究, 或回到进行中/最近完成的任务。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/app/projects" className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-gray-800">
            + 新建项目
          </Link>
          <Link href="/app/search" className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:border-gray-900">
            快速搜人
          </Link>
          <Link href="/app/verify" className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:border-gray-900">
            快速核验
          </Link>
        </div>
      </header>

      {error === "__SESSION_EXPIRED__" ? (
        <div className="rounded-xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-800">
          <p>会话已过期, 请重新登录。</p>
          <button
            onClick={async () => {
              const { logout } = await import("@/lib/auth");
              await logout();
              location.href = "/";
            }}
            className="mt-2 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700"
          >
            退出并重新登录
          </button>
        </div>
      ) : error ? (
        <p className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">出错: {error}</p>
      ) : null}

      {/* KPI 卡 */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {KPI_CONFIG.map((cfg) => (
          <div key={cfg.key} className="relative overflow-hidden rounded-2xl border border-gray-100 bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
            <div className={`pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br ${cfg.accent} to-transparent blur-2xl`} />
            <div className="relative flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{cfg.label}</p>
                <p className="mt-2 text-3xl font-extrabold tabular-nums tracking-tight text-gray-900">
                  {data ? data.kpi[cfg.key] : "—"}
                </p>
                <p className="mt-0.5 text-xs text-gray-500">{cfg.sub}</p>
              </div>
              <span className="text-2xl leading-none">{cfg.icon}</span>
            </div>
          </div>
        ))}
      </section>

      {/* 进行中招聘项目 */}
      {data && data.active_projects.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-end justify-between">
            <h2 className="text-sm font-semibold text-gray-700">进行中项目</h2>
            <Link href="/app/projects" className="text-xs text-gray-500 hover:text-gray-900">查看全部 →</Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {data.active_projects.map((p) => (
              <Link
                key={p.id}
                href={`/app/projects/${p.id}`}
                className="group rounded-2xl border border-gray-100 bg-white p-4 shadow-[0_8px_30px_rgba(0,0,0,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_40px_rgba(0,0,0,0.08)]"
              >
                <p className="line-clamp-2 text-sm font-semibold text-gray-900 group-hover:underline">{p.name}</p>
                {p.brief && <p className="mt-1 line-clamp-1 text-xs text-gray-500">{p.brief}</p>}
                <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-gray-600">
                  <span className="rounded-md bg-gray-50 px-1.5 py-0.5 ring-1 ring-gray-100">{p.candidates_total} 候选人</span>
                  {p.runs_active > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-amber-800 ring-1 ring-amber-100">
                      <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
                      {p.runs_active} 研究中
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 进行中任务 + 最近研究 */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* 进行中 */}
        <section className="space-y-3">
          <div className="flex items-end justify-between">
            <h2 className="text-sm font-semibold text-gray-700">进行中的任务</h2>
            {data && data.active_jobs.length > 0 && (
              <span className="text-xs text-gray-400">{data.active_jobs.length} 个</span>
            )}
          </div>
          {!data && <p className="text-sm text-gray-400">加载中…</p>}
          {data && data.active_jobs.length === 0 && (
            <div className="rounded-xl border border-dashed border-gray-200 bg-white p-5 text-center text-sm text-gray-500">
              暂无进行中的任务
            </div>
          )}
          {data && data.active_jobs.length > 0 && (
            <ul className="space-y-2">
              {data.active_jobs.map((j) => (
                <li key={j.id} className="flex items-start justify-between gap-3 rounded-xl border border-gray-200 bg-white p-3.5">
                  <span className="flex min-w-0 flex-1 items-start gap-2">
                    <KindBadge kind={j.kind} />
                    <span className="min-w-0 truncate text-sm text-gray-800" title={j.label}>{j.label}</span>
                  </span>
                  <StatusDot status={j.status} />
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 最近研究 */}
        <section className="space-y-3">
          <div className="flex items-end justify-between">
            <h2 className="text-sm font-semibold text-gray-700">最近研究</h2>
            <Link href="/app/history" className="text-xs text-gray-500 hover:text-gray-900">查看全部 →</Link>
          </div>
          {!data && <p className="text-sm text-gray-400">加载中…</p>}
          {data && data.recent.length === 0 && (
            <div className="rounded-xl border border-dashed border-gray-200 bg-white p-5 text-center text-sm text-gray-500">
              还没有完成的研究
            </div>
          )}
          {data && data.recent.length > 0 && (
            <ul className="space-y-2">
              {data.recent.map((r, i) => {
                const target = r.kind === "search"
                  ? `/app/search?q=${encodeURIComponent(r.query_text)}`
                  : `/app/verify?bio=${encodeURIComponent(r.query_text)}`;
                return (
                  <li key={i}>
                    <Link href={target} className="flex items-start justify-between gap-3 rounded-xl border border-gray-200 bg-white p-3.5 transition hover:border-blue-400">
                      <span className="flex min-w-0 flex-1 items-start gap-2">
                        <KindBadge kind={r.kind} />
                        <span className="min-w-0 truncate text-sm text-gray-800" title={r.query_text}>{r.label}</span>
                      </span>
                      <span className="shrink-0 text-xs text-gray-400">{r.summary}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {/* 空状态 onboarding */}
      {empty && (
        <section className="rounded-2xl border border-dashed border-gray-200 bg-white p-6">
          <h3 className="text-sm font-semibold text-gray-800">开始第一步</h3>
          <p className="mt-1 text-xs text-gray-500">三个动作选一个,SignalHire 让你直接拿到带证据的候选人。</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Link href="/app/search" className="group rounded-xl border border-gray-100 bg-white p-4 transition hover:border-gray-900">
              <p className="text-base font-semibold text-gray-900">🔍 搜人</p>
              <p className="mt-1 text-xs text-gray-500">给一段招聘需求, MiroMind 全网搜出 10-15 个候选人。</p>
            </Link>
            <Link href="/app/verify" className="group rounded-xl border border-gray-100 bg-white p-4 transition hover:border-gray-900">
              <p className="text-base font-semibold text-gray-900">✅ 核验</p>
              <p className="mt-1 text-xs text-gray-500">粘贴候选人自述, 跨源核实每条声称, 揭示红旗。</p>
            </Link>
            <Link href="/app/history" className="group rounded-xl border border-gray-100 bg-white p-4 transition hover:border-gray-900">
              <p className="text-base font-semibold text-gray-900">🕓 历史</p>
              <p className="mt-1 text-xs text-gray-500">回看以前的研究, 1 秒打开完整 shortlist。</p>
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
