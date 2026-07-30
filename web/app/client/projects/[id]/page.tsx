"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { FiArrowLeft, FiExternalLink, FiMessageSquare, FiSend, FiUsers } from "react-icons/fi";
import { useI18n } from "@/components/LanguageProvider";
import { EmptyState, LoadingState, LogoMark, MetricCard, SecondaryAction, Surface } from "@/components/ui/signal-ui";
import type { ClientPortalProjectView } from "@/lib/client-portal-workspace";

const TABS = ["overview", "interview-ready", "weekly-archive", "reports", "feedback"] as const;
type Tab = typeof TABS[number];

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

function tabLabel(tab: Tab, isEn: boolean) {
  const labels: Record<Tab, string> = {
    overview: isEn ? "Overview" : "概览",
    "interview-ready": "Interview-ready",
    "weekly-archive": isEn ? "Weekly archive" : "周交付归档",
    reports: isEn ? "Reports" : "报告版本",
    feedback: isEn ? "Feedback" : "反馈",
  };
  return labels[tab];
}

function metricText(metrics: Record<string, unknown>, locale: string) {
  const values = {
    new_candidates: Number(metrics.new_candidates ?? metrics.candidates ?? 0),
    contacted: Number(metrics.contacted ?? 0),
    replied: Number(metrics.replied ?? 0),
    interview_ready: Number(metrics.interview_ready ?? 0),
    confirmed: Number(metrics.confirmed ?? 0),
  };
  return locale === "en"
    ? `${values.new_candidates} new · ${values.contacted} contacted · ${values.replied} replied · ${values.interview_ready} ready · ${values.confirmed} confirmed`
    : `${values.new_candidates} 新增 · ${values.contacted} 已联系 · ${values.replied} 已回复 · ${values.interview_ready} 可约面 · ${values.confirmed} 已确认`;
}

function accessText(view: ClientPortalProjectView, isEn: boolean) {
  const access = view.access;
  if (!access?.viewer_email) return "";
  if (access.method === "domain" && access.matched) {
    return isEn
      ? `You are signed in as ${access.viewer_email}. Access is granted through ${access.matched}.`
      : `你当前使用 ${access.viewer_email} 登录，通过 ${access.matched} 域名授权访问。`;
  }
  return isEn
    ? `You are signed in as ${access.viewer_email}. Access is granted to this email.`
    : `你当前使用 ${access.viewer_email} 登录，该邮箱已被授权访问。`;
}

export default function ClientProjectPage() {
  const { id } = useParams<{ id: string }>();
  const projectId = Array.isArray(id) ? id[0] : id;
  const { locale } = useI18n();
  const isEn = locale === "en";
  const [view, setView] = useState<ClientPortalProjectView | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [error, setError] = useState("");
  const [sentiment, setSentiment] = useState("ready_to_interview");
  const [note, setNote] = useState("");
  const [selectedReportId, setSelectedReportId] = useState("");
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/client-portal/projects/${projectId}?locale=${locale}`);
      if (response.status === 401) {
        setNeedsLogin(true);
        setError("");
        return;
      }
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || (isEn ? "Unable to load project." : "无法加载项目。"));
      const nextView = json as ClientPortalProjectView;
      setView(nextView);
      setSelectedReportId((current) => nextView.reports.some((report) => report.id === current) ? current : (nextView.reports[0]?.id ?? ""));
      setNeedsLogin(false);
      setError("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [isEn, locale, projectId]);

  useEffect(() => {
    const id = window.setTimeout(() => { void reload(); }, 0);
    return () => window.clearTimeout(id);
  }, [reload]);

  async function submitFeedback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!projectId || !selectedReportId || !note.trim()) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/client-portal/projects/${projectId}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report_id: selectedReportId, sentiment, note, locale }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || (isEn ? "Unable to save feedback." : "无法保存反馈。"));
      setNote("");
      await reload();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--sh-bg)] text-[var(--sh-ink)]">
      <header className="border-b border-black/10 bg-white/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <Link href="/client" className="flex items-center gap-2 text-sm font-semibold text-[var(--sh-ink)]">
            <LogoMark className="h-8 w-8" />
            <span>SignalHire</span>
          </Link>
          <SecondaryAction href="/client"><FiArrowLeft className="h-4 w-4" aria-hidden="true" /> {isEn ? "Workspace" : "工作台"}</SecondaryAction>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 md:py-8">
        {error && <p className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
        {loading ? (
          <LoadingState title={isEn ? "Loading project" : "正在加载项目"} description={isEn ? "Preparing the client-safe workspace." : "正在准备客户可见工作区。"} />
        ) : needsLogin ? (
          <EmptyState
            title={isEn ? "Sign in to continue" : "请先登录"}
            description={isEn ? "Use the email your recruiting team authorized for this project." : "请使用招聘团队授权的客户邮箱登录。"}
            action={<SecondaryAction href={`/login?next=/client/projects/${projectId}`}>{isEn ? "Sign in" : "登录"}</SecondaryAction>}
          />
        ) : !view ? (
          <EmptyState title={isEn ? "Project unavailable" : "项目不可访问"} description={isEn ? "This project is not authorized for your account." : "当前账号没有访问该项目的权限。"} />
        ) : (
          <>
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--sh-muted)]">{isEn ? "Client project" : "客户项目"}</p>
                <h1 className="mt-2 text-2xl font-semibold tracking-normal text-[var(--sh-ink)] md:text-3xl">{view.project.name}</h1>
                {view.project.brief && <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--sh-muted)]">{view.project.brief}</p>}
              </div>
              {accessText(view, isEn) && (
                <div className="rounded-2xl border border-black/10 bg-white/80 px-4 py-3 text-sm font-medium text-[var(--sh-muted)]">
                  {accessText(view, isEn)}
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                <MetricCard label={isEn ? "Candidates" : "候选人"} value={view.summary.candidates} Icon={FiUsers} tone="blue" />
                <MetricCard label={isEn ? "Contacted" : "已联系"} value={view.summary.contacted} />
                <MetricCard label={isEn ? "Replied" : "已回复"} value={view.summary.replied} Icon={FiMessageSquare} tone="amber" />
                <MetricCard label="Interview-ready" value={view.summary.interview_ready} tone="green" />
                <MetricCard label={isEn ? "Confirmed" : "已确认"} value={view.summary.confirmed} />
              </div>
            </div>

            <div className="overflow-x-auto pb-1">
              <div className="inline-flex min-w-max rounded-2xl bg-white p-1 ring-1 ring-black/10">
                {TABS.map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={`rounded-xl px-4 py-2 text-sm font-semibold ${activeTab === tab ? "bg-[var(--sh-ink)] text-white" : "text-[var(--sh-muted)] hover:text-[var(--sh-ink)]"}`}
                  >
                    {tabLabel(tab, isEn)}
                  </button>
                ))}
              </div>
            </div>

            {activeTab === "overview" && (
              <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
                <Surface className="p-5">
                  <h2 className="text-base font-semibold text-[var(--sh-ink)]">{isEn ? "This week" : "本周推进"}</h2>
                  <p className="mt-3 text-sm leading-6 text-[var(--sh-muted)]">
                    {view.overview.latest_weekly_archive
                      ? metricText((view.overview.latest_weekly_archive as { metrics?: Record<string, unknown> }).metrics ?? {}, locale)
                      : (isEn ? "No weekly archive yet." : "暂无周交付归档。")}
                  </p>
                </Surface>
                <Surface className="p-5">
                  <h2 className="text-base font-semibold text-[var(--sh-ink)]">{isEn ? "Decisions" : "需要决定"}</h2>
                  <div className="mt-3 space-y-2 text-sm leading-6 text-[var(--sh-muted)]">
                    {(view.overview.next_actions.length ? view.overview.next_actions : [isEn ? "No immediate decision is required." : "暂无需要客户处理的事项。"]).map((item) => (
                      <p key={item}>{item}</p>
                    ))}
                    {view.overview.risks.map((item) => (
                      <p key={item} className="rounded-xl bg-amber-50 px-3 py-2 text-amber-800">{item}</p>
                    ))}
                  </div>
                </Surface>
              </div>
            )}

            {activeTab === "interview-ready" && (
              <div className="space-y-3">
                {view.interview_ready_queue.length === 0 ? (
                  <EmptyState title={isEn ? "No interview-ready candidates" : "暂无可约面候选人"} description={isEn ? "New interested replies will appear here." : "有意向并可推进约面的候选人会出现在这里。"} />
                ) : view.interview_ready_queue.map((candidate) => {
                  const item = candidate as {
                    id: string; name: string; headline: string; evidence_summary: string; risks: string[];
                    scheduling_state: string; next_action: string; message_history: { summary: { inbound: number; outbound: number; total: number } };
                  };
                  return (
                    <Surface key={item.id} className="p-5">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <h2 className="text-base font-semibold text-[var(--sh-ink)]">{item.name}</h2>
                          {item.headline && <p className="mt-1 text-sm text-[var(--sh-muted)]">{item.headline}</p>}
                        </div>
                        {item.scheduling_state && <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">{item.scheduling_state}</span>}
                      </div>
                      {item.evidence_summary && <p className="mt-3 text-sm leading-6 text-[var(--sh-muted)]">{item.evidence_summary}</p>}
                      {item.risks.map((risk) => <p key={risk} className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">{risk}</p>)}
                      <p className="mt-3 text-sm text-[var(--sh-muted)]">
                        {isEn ? "Message history" : "消息历史"} · {item.message_history.summary.inbound} {isEn ? "inbound" : "候选人消息"} / {item.message_history.summary.outbound} {isEn ? "outbound" : "团队消息"}
                      </p>
                      {item.next_action && <p className="mt-2 text-sm font-medium text-[var(--sh-ink)]">{item.next_action}</p>}
                    </Surface>
                  );
                })}
              </div>
            )}

            {activeTab === "weekly-archive" && (
              <div className="space-y-3">
                {view.weekly_archives.length === 0 ? (
                  <EmptyState title={isEn ? "No weekly archive" : "暂无周交付归档"} description={isEn ? "Weekly delivery records will appear after reports are generated." : "生成周交付记录后会展示在这里。"} />
                ) : view.weekly_archives.map((archive) => {
                  const item = archive as { archive_id: string; week_start: string; week_end: string; metrics: Record<string, unknown>; risks: string[]; next_actions: string[] };
                  return (
                    <Surface key={item.archive_id} className="p-5">
                      <h2 className="text-base font-semibold text-[var(--sh-ink)]">{item.week_start} - {item.week_end}</h2>
                      <p className="mt-3 text-sm leading-6 text-[var(--sh-muted)]">{metricText(item.metrics, locale)}</p>
                      {item.risks.map((risk) => <p key={risk} className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">{risk}</p>)}
                      {item.next_actions.map((action) => <p key={action} className="mt-2 text-sm text-[var(--sh-muted)]">{action}</p>)}
                    </Surface>
                  );
                })}
              </div>
            )}

            {activeTab === "reports" && (
              <div className="space-y-3">
                {view.reports.length === 0 ? (
                  <EmptyState title={isEn ? "No reports" : "暂无报告"} description={isEn ? "Report versions will appear here." : "项目报告版本会展示在这里。"} />
                ) : view.reports.map((report) => (
                  <Surface key={report.id} className="p-5">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <h2 className="text-base font-semibold text-[var(--sh-ink)]">{report.label}</h2>
                        <p className="mt-1 text-sm text-[var(--sh-muted)]">{report.summary || dateLabel(report.updated_at, locale)}</p>
                      </div>
                      <SecondaryAction href={report.href}>
                        {isEn ? "Open report" : "打开报告"} <FiExternalLink className="h-4 w-4" aria-hidden="true" />
                      </SecondaryAction>
                    </div>
                  </Surface>
                ))}
              </div>
            )}

            {activeTab === "feedback" && (
              <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
                <Surface className="p-5">
                  <h2 className="text-base font-semibold text-[var(--sh-ink)]">{isEn ? "Send feedback" : "提交反馈"}</h2>
                  {view.reports.length === 0 ? (
                    <EmptyState title={isEn ? "No report version to review" : "暂无可反馈的报告版本"} description={isEn ? "Feedback becomes available after a report is generated." : "生成项目报告后即可提交反馈。"} />
                  ) : (
                    <form className="mt-4 space-y-3" onSubmit={submitFeedback}>
                      <label className="block text-sm font-medium text-[var(--sh-ink)]">
                        {isEn ? "Report version" : "报告版本"}
                        <select value={selectedReportId} onChange={(event) => setSelectedReportId(event.target.value)} className="mt-2 min-h-11 w-full rounded-2xl border border-black/10 bg-white px-3 text-sm font-medium outline-none focus:border-[var(--sh-blue)]">
                          {view.reports.map((report) => <option key={report.id} value={report.id}>{report.label}</option>)}
                        </select>
                      </label>
                      <select value={sentiment} onChange={(event) => setSentiment(event.target.value)} className="min-h-11 w-full rounded-2xl border border-black/10 bg-white px-3 text-sm font-medium outline-none focus:border-[var(--sh-blue)]">
                        <option value="ready_to_interview">{isEn ? "Ready to interview" : "可以约面"}</option>
                        <option value="needs_more_candidates">{isEn ? "Need more candidates" : "需要更多候选人"}</option>
                        <option value="needs_stronger_evidence">{isEn ? "Need stronger evidence" : "需要更强证据"}</option>
                        <option value="not_a_fit">{isEn ? "Not a fit" : "不匹配"}</option>
                      </select>
                      <textarea
                        value={note}
                        onChange={(event) => setNote(event.target.value)}
                        rows={5}
                        className="w-full rounded-2xl border border-black/10 bg-white px-3 py-3 text-sm leading-6 outline-none focus:border-[var(--sh-blue)]"
                        placeholder={isEn ? "Add context for the recruiting team." : "给招聘团队补充上下文。"}
                      />
                      <button type="submit" disabled={saving || !selectedReportId || !note.trim()} className="sh-primary-action w-full justify-center disabled:opacity-50">
                        <FiSend className="h-4 w-4" aria-hidden="true" /> {saving ? (isEn ? "Saving" : "保存中") : (isEn ? "Send feedback" : "提交反馈")}
                      </button>
                    </form>
                  )}
                </Surface>
                <Surface className="p-5">
                  <h2 className="text-base font-semibold text-[var(--sh-ink)]">{isEn ? "Feedback history" : "反馈历史"}</h2>
                  <div className="mt-4 space-y-3">
                    {view.feedback_history.length === 0 ? (
                      <p className="text-sm text-[var(--sh-muted)]">{isEn ? "No feedback yet." : "暂无反馈。"}</p>
                    ) : view.feedback_history.map((event) => {
                      const item = event as { event_at: string; sentiment: string; actor: string; note: string; report_href: string };
                      return (
                        <div key={`${item.event_at}:${item.note}`} className="rounded-2xl border border-black/10 bg-white/80 p-4">
                          <p className="text-sm font-semibold text-[var(--sh-ink)]">{item.sentiment || (isEn ? "Feedback" : "反馈")}</p>
                          <p className="mt-1 text-xs text-[var(--sh-muted)]">{item.actor} · {dateLabel(item.event_at, locale)}</p>
                          {item.note && <p className="mt-2 text-sm leading-6 text-[var(--sh-muted)]">{item.note}</p>}
                        </div>
                      );
                    })}
                  </div>
                </Surface>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
