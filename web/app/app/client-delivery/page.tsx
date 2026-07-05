"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FiDownloadCloud, FiExternalLink, FiFileText, FiMessageSquare } from "react-icons/fi";
import { useI18n } from "@/components/LanguageProvider";
import { EmptyState, LoadingState, MetricCard, PageIntro, SecondaryAction, SegmentedControl, Surface } from "@/components/ui/signal-ui";
import type { ClientDeliveryAuditCenterView } from "@/lib/client-delivery-audit-center";

type AuditRange = "7d" | "30d" | "90d" | "all";
type AuditType = "all" | "report_view" | "feedback";

const EMPTY_VIEW: ClientDeliveryAuditCenterView = {
  locale: "zh",
  filters: { project: "all", range: "30d", type: "all" },
  projects: [],
  summary: { report_views: 0, feedback: 0, weekly_archives: 0, latest_activity: "" },
  events: [],
  weekly_archives: [],
};

function dateLabel(value: string, locale: string) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function metricLine(metrics: ClientDeliveryAuditCenterView["weekly_archives"][number]["metrics"], locale: string) {
  return locale === "en"
    ? `${metrics.new_candidates} new, ${metrics.contacted} contacted, ${metrics.replied} replied, ${metrics.interview_ready} interview-ready, ${metrics.confirmed} confirmed`
    : `${metrics.new_candidates} 新增，${metrics.contacted} 已联系，${metrics.replied} 已回复，${metrics.interview_ready} 可约面，${metrics.confirmed} 已确认`;
}

function queryString(locale: string, project: string, range: AuditRange, type: AuditType) {
  return new URLSearchParams({ locale, project, range, type }).toString();
}

function eventLabel(event: ClientDeliveryAuditCenterView["events"][number], isEn: boolean) {
  if (event.display_type === "feedback") return isEn ? "Client feedback" : "客户反馈";
  if (event.display_type === "portal_project_view") return isEn ? "Portal project viewed" : "门户项目查看";
  return isEn ? "Report viewed" : "报告查看";
}

function eventLinkLabel(event: ClientDeliveryAuditCenterView["events"][number], isEn: boolean) {
  if (event.display_type === "portal_project_view") return isEn ? "Open portal" : "打开门户";
  return isEn ? "View report" : "查看报告";
}

export default function ClientDeliveryAuditPage() {
  const { locale } = useI18n();
  const isEn = locale === "en";
  const [project, setProject] = useState("all");
  const [range, setRange] = useState<AuditRange>("30d");
  const [type, setType] = useState<AuditType>("all");
  const [view, setView] = useState<ClientDeliveryAuditCenterView>(EMPTY_VIEW);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const params = useMemo(() => queryString(locale, project, range, type), [locale, project, range, type]);
  const exportHref = `/api/client-delivery/audit/export?${params}`;

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/client-delivery/audit?${params}`);
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || (isEn ? "Unable to load client delivery audit." : "无法加载客户交付审计。"));
      setView(json as ClientDeliveryAuditCenterView);
      setError("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [isEn, params]);

  useEffect(() => {
    const id = window.setTimeout(() => { void reload(); }, 0);
    return () => window.clearTimeout(id);
  }, [reload]);

  const projectOptions = useMemo(() => [
    { value: "all", label: isEn ? "All projects" : "全部项目" },
    ...view.projects.map((item) => ({ value: item.id, label: item.name })),
  ], [isEn, view.projects]);

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow={isEn ? "Client Delivery" : "客户交付"}
        title={isEn ? "Client delivery audit" : "客户交付审计"}
        description={isEn
          ? "Review client report views, feedback, and weekly delivery archives across roles."
          : "查看各岗位客户报告的访问、反馈和周交付归档。"}
        actions={(
          <SecondaryAction href={exportHref}>
            <FiDownloadCloud className="h-4 w-4" aria-hidden="true" />
            CSV export
          </SecondaryAction>
        )}
      />

      {error && <p className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">{error}</p>}

      <Surface className="p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_auto_auto] lg:items-center">
          <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--sh-muted)]">
            {isEn ? "Project" : "项目"}
            <select
              value={project}
              onChange={(event) => setProject(event.target.value)}
              className="min-h-10 rounded-2xl border border-black/10 bg-white px-3 text-sm font-medium text-[var(--sh-ink)] outline-none focus:border-[var(--sh-blue)]"
            >
              {projectOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <SegmentedControl
            value={range}
            onChange={setRange}
            items={[
              { value: "7d", label: "7d" },
              { value: "30d", label: "30d" },
              { value: "90d", label: "90d" },
              { value: "all", label: isEn ? "All" : "全部" },
            ]}
          />
          <SegmentedControl
            value={type}
            onChange={setType}
            items={[
              { value: "all", label: isEn ? "All" : "全部" },
              { value: "report_view", label: isEn ? "Views" : "查看" },
              { value: "feedback", label: isEn ? "Feedback" : "反馈" },
            ]}
          />
        </div>
      </Surface>

      {loading ? (
        <LoadingState title={isEn ? "Loading audit" : "正在加载审计"} description={isEn ? "Syncing client delivery records." : "正在同步客户交付记录。"} />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard label={isEn ? "Report views" : "报告查看"} value={view.summary.report_views} Icon={FiFileText} tone="blue" />
            <MetricCard label={isEn ? "Feedback" : "反馈"} value={view.summary.feedback} Icon={FiMessageSquare} tone="green" />
            <MetricCard label={isEn ? "Weekly archives" : "周归档"} value={view.summary.weekly_archives} Icon={FiFileText} tone="amber" />
            <MetricCard label={isEn ? "Latest activity" : "最近活动"} value={dateLabel(view.summary.latest_activity, locale) || "-"} />
          </div>

          <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
            <Surface className="p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-[var(--sh-ink)]">{isEn ? "Audit timeline" : "审计时间线"}</h2>
                  <p className="mt-1 text-xs text-[var(--sh-muted)]">{isEn ? "Client report views and feedback." : "客户报告查看和反馈。"}</p>
                </div>
              </div>
              {view.events.length === 0 ? (
                <div className="mt-4"><EmptyState title={isEn ? "No audit events" : "暂无审计事件"} description={isEn ? "No client views or feedback match these filters." : "当前筛选下没有客户查看或反馈。"} /></div>
              ) : (
                <div className="mt-4 space-y-3">
                  {view.events.map((event) => (
                    <div key={`${event.event_type}:${event.event_at}:${event.report_href}`} className="rounded-2xl border border-black/10 bg-white/80 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-[var(--sh-ink)]">
                            {eventLabel(event, isEn)}
                          </p>
                          <p className="mt-1 text-xs text-[var(--sh-muted)]">{event.project_name} · {dateLabel(event.event_at, locale)}</p>
                        </div>
                        {event.report_href && (
                          <a href={event.report_href} className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--sh-blue)]">
                            {eventLinkLabel(event, isEn)} <FiExternalLink className="h-3 w-3" aria-hidden="true" />
                          </a>
                        )}
                      </div>
                      <p className="mt-3 text-sm leading-6 text-[var(--sh-muted)]">
                        {[event.actor, event.sentiment, event.note].filter(Boolean).join(" · ") || (isEn ? "Client opened the report." : "客户打开了报告。")}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </Surface>

            <Surface className="p-5">
              <h2 className="text-base font-semibold text-[var(--sh-ink)]">{isEn ? "Weekly delivery archive" : "周交付归档"}</h2>
              <p className="mt-1 text-xs text-[var(--sh-muted)]">{isEn ? "Persisted weekly delivery records." : "已持久化的周交付记录。"}</p>
              {view.weekly_archives.length === 0 ? (
                <div className="mt-4"><EmptyState title={isEn ? "No weekly archives" : "暂无周归档"} description={isEn ? "No weekly archive matches these filters." : "当前筛选下没有周交付归档。"} /></div>
              ) : (
                <div className="mt-4 space-y-3">
                  {view.weekly_archives.map((archive) => (
                    <div key={archive.archive_id} className="rounded-2xl border border-black/10 bg-white/80 p-4">
                      <p className="text-sm font-semibold text-[var(--sh-ink)]">{archive.project_name}</p>
                      <p className="mt-1 text-xs text-[var(--sh-muted)]">{archive.week_start} - {archive.week_end} · {archive.archive_id}</p>
                      <p className="mt-3 text-sm leading-6 text-[var(--sh-muted)]">{metricLine(archive.metrics, locale)}</p>
                      {archive.risks[0] && <p className="mt-2 text-xs text-amber-700">{archive.risks[0]}</p>}
                      {archive.next_actions[0] && <p className="mt-1 text-xs text-[var(--sh-muted)]">{archive.next_actions[0]}</p>}
                    </div>
                  ))}
                </div>
              )}
            </Surface>
          </div>
        </>
      )}
    </div>
  );
}
