"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { FiArrowRight, FiBriefcase, FiClock, FiMessageSquare, FiUsers } from "react-icons/fi";
import { useI18n } from "@/components/LanguageProvider";
import { EmptyState, LoadingState, LogoMark, MetricCard, SecondaryAction, Surface } from "@/components/ui/signal-ui";
import type { ClientPortalWorkspaceView } from "@/lib/client-portal-workspace";

const EMPTY_VIEW: ClientPortalWorkspaceView = {
  locale: "zh",
  viewer: { email: "" },
  summary: { authorized_projects: 0, interview_ready: 0, this_week_replies: 0, latest_activity: "" },
  latest_activity: "",
  pagination: { offset: 0, total: 0, has_more: false, next_offset: null },
  recent_weekly_archives: [],
  interview_ready_queue: [],
  projects: [],
};

function dateLabel(value: string, locale: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "-";
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function metricLine(metrics: ClientPortalWorkspaceView["projects"][number]["metrics"], locale: string) {
  return locale === "en"
    ? `${metrics.candidates} candidates · ${metrics.contacted} contacted · ${metrics.replied} replied · ${metrics.interview_ready} ready`
    : `${metrics.candidates} 候选人 · ${metrics.contacted} 已联系 · ${metrics.replied} 已回复 · ${metrics.interview_ready} 可约面`;
}

function accessLine(access: ClientPortalWorkspaceView["projects"][number]["access"], isEn: boolean) {
  if (!access?.viewer_email) return "";
  if (access.method === "domain" && access.matched) {
    return isEn ? `Signed in as ${access.viewer_email} · domain access: ${access.matched}` : `当前账号 ${access.viewer_email} · 域名授权：${access.matched}`;
  }
  return isEn ? `Signed in as ${access.viewer_email} · email access` : `当前账号 ${access.viewer_email} · 邮箱授权`;
}

function ClientHeader({ isEn }: { isEn: boolean }) {
  return (
    <header className="border-b border-black/10 bg-white/80">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
        <Link href="/" className="flex items-center gap-2 text-sm font-semibold text-[var(--sh-ink)]">
          <LogoMark className="h-8 w-8" />
          <span>SignalHire</span>
        </Link>
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--sh-muted)]">
          {isEn ? "Client workspace" : "客户工作台"}
        </span>
      </div>
    </header>
  );
}

export default function ClientWorkspacePage() {
  const { locale } = useI18n();
  const isEn = locale === "en";
  const [view, setView] = useState<ClientPortalWorkspaceView>(EMPTY_VIEW);
  const [loading, setLoading] = useState(true);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [error, setError] = useState("");

  const loadWorkspace = useCallback(async (offset = 0, append = false) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/client-portal/workspace?locale=${locale}&offset=${offset}`);
      if (response.status === 401) {
        setNeedsLogin(true);
        setError("");
        return;
      }
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || (isEn ? "Unable to load client workspace." : "无法加载客户工作台。"));
      const nextView = json as ClientPortalWorkspaceView;
      setView((current) => append ? {
        ...nextView,
        projects: [...current.projects, ...nextView.projects],
        summary: {
          ...nextView.summary,
          interview_ready: current.summary.interview_ready + nextView.summary.interview_ready,
          this_week_replies: current.summary.this_week_replies + nextView.summary.this_week_replies,
        },
      } : nextView);
      setNeedsLogin(false);
      setError("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [isEn, locale]);

  const reload = useCallback(() => loadWorkspace(), [loadWorkspace]);

  const loadMore = useCallback(() => {
    const offset = view.pagination.next_offset;
    if (offset === null) return;
    void loadWorkspace(offset, true);
  }, [loadWorkspace, view.pagination.next_offset]);

  useEffect(() => {
    const id = window.setTimeout(() => { void reload(); }, 0);
    return () => window.clearTimeout(id);
  }, [reload]);

  return (
    <div className="min-h-screen bg-[var(--sh-bg)] text-[var(--sh-ink)]">
      <ClientHeader isEn={isEn} />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 md:py-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--sh-muted)]">{isEn ? "Delivery" : "客户交付"}</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-normal text-[var(--sh-ink)] md:text-3xl">
              {isEn ? "Client delivery workspace" : "客户交付工作台"}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--sh-muted)]">
              {isEn
                ? "Review authorized roles, weekly progress, interview-ready candidates, report versions, risks, and feedback history."
                : "查看已授权项目、周交付进展、可约面候选人、报告版本、风险和反馈历史。"}
            </p>
            {view.viewer.email && !loading && !needsLogin && (
              <p className="mt-2 text-xs font-medium text-[var(--sh-faint)]">
                {isEn ? `Signed in as ${view.viewer.email}` : `当前客户账号：${view.viewer.email}`}
              </p>
            )}
          </div>
        </div>

        {error && <p className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">{error}</p>}

        {loading ? (
          <LoadingState title={isEn ? "Loading workspace" : "正在加载工作台"} description={isEn ? "Checking your authorized projects." : "正在检查你可访问的项目。"} />
        ) : needsLogin ? (
          <EmptyState
            title={isEn ? "Sign in to continue" : "请先登录"}
            description={isEn ? "Use the email your recruiting team authorized for client delivery." : "请使用招聘团队授权的客户邮箱登录。"}
            action={<SecondaryAction href={`/login?next=/client`}>{isEn ? "Sign in" : "登录"}</SecondaryAction>}
          />
        ) : view.projects.length === 0 ? (
          <EmptyState
            title={isEn ? "No authorized projects" : "暂无被授权项目"}
            description={isEn ? "Contact your recruiting team to enable customer account access." : "请联系招聘团队开通客户账号访问。"}
          />
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard label={isEn ? "Authorized projects" : "已授权项目"} value={view.summary.authorized_projects} Icon={FiBriefcase} tone="blue" />
              <MetricCard label={isEn ? "Interview-ready (loaded)" : "可约面（已加载）"} value={view.summary.interview_ready} Icon={FiUsers} tone="green" />
              <MetricCard label={isEn ? "This week replies (loaded)" : "本周回复（已加载）"} value={view.summary.this_week_replies} Icon={FiMessageSquare} tone="amber" />
              <MetricCard label={isEn ? "Latest activity" : "最近活动"} value={dateLabel(view.summary.latest_activity, locale)} Icon={FiClock} />
            </div>

            <div className="space-y-3">
              {view.projects.map((project) => (
                <Surface key={project.id} className="p-5">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <p className="text-base font-semibold text-[var(--sh-ink)]">{project.name}</p>
                      {project.brief && <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--sh-muted)]">{project.brief}</p>}
                      <p className="mt-3 text-sm font-medium text-[var(--sh-muted)]">{metricLine(project.metrics, locale)}</p>
                      {accessLine(project.access, isEn) && <p className="mt-2 text-xs font-medium text-[var(--sh-faint)]">{accessLine(project.access, isEn)}</p>}
                      {project.risks[0] && <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">{project.risks[0]}</p>}
                      {project.next_actions[0] && <p className="mt-2 text-sm text-[var(--sh-muted)]">{project.next_actions[0]}</p>}
                    </div>
                    <SecondaryAction href={`/client/projects/${project.id}`} className="w-full justify-center md:w-auto">
                      {isEn ? "Open" : "进入"} <FiArrowRight className="h-4 w-4" aria-hidden="true" />
                    </SecondaryAction>
                  </div>
                </Surface>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-[var(--sh-muted)]">
              <p>{isEn ? `Showing ${view.projects.length} of ${view.pagination.total} authorized projects.` : `已显示 ${view.projects.length}/${view.pagination.total} 个已授权项目。`}</p>
              {view.pagination.has_more && view.pagination.next_offset !== null ? (
                <SecondaryAction onClick={loadMore} disabled={loading}>
                  {isEn ? "Show more projects" : "显示更多项目"}
                </SecondaryAction>
              ) : null}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
