"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FiAlertCircle, FiCheckCircle, FiChevronRight, FiClock, FiFilter, FiRefreshCw, FiSearch, FiX } from "react-icons/fi";
import { useI18n } from "@/components/LanguageProvider";
import { EmptyState, LoadingState, PageIntro, PrimaryAction, SecondaryAction, StatusBadge, Surface } from "@/components/ui/signal-ui";

type HistoryStatus = "all" | "queued" | "running" | "retrying" | "done" | "error" | "canceled" | "needs_action";
type HistoryKind = "all" | "search" | "verify";
type HistoryRange = "all" | "today" | "7d" | "30d";
type EvidenceFilter = "all" | "high_confidence" | "needs_verification" | "low_evidence" | "has_gaps" | "shortlist_ready";

type HistoryFilters = {
  q: string;
  kind: HistoryKind;
  status: HistoryStatus;
  range: HistoryRange;
  projectId: string;
  evidence: EvidenceFilter;
};

type HistoryItem = {
  id: string;
  kind: "search" | "verify";
  status: string;
  status_label: string;
  label: string;
  summary: string;
  query_text: string;
  project_id: string | null;
  project_name: string | null;
  updated_at: string;
  next_action: {
    label: string;
    href: string;
    kind: "open" | "retry" | "adjust" | "progress";
  };
  evidence_summary?: {
    candidate_count: number;
    high_confidence_count: number;
    needs_verification_count: number;
    low_evidence_count: number;
    primary_gaps: string[];
    has_gaps: boolean;
    shortlist_ready: boolean;
  };
  needs_action: boolean;
};

type ProjectOption = { id: string; name: string };

const DEFAULT_FILTERS: HistoryFilters = {
  q: "",
  kind: "all",
  status: "all",
  range: "all",
  projectId: "",
  evidence: "all",
};

const QUICK_FILTERS: Array<{ key: string; patch: Partial<HistoryFilters>; zh: string; en: string }> = [
  { key: "all", patch: DEFAULT_FILTERS, zh: "全部", en: "All" },
  { key: "search", patch: { kind: "search" }, zh: "搜人", en: "Search" },
  { key: "verify", patch: { kind: "verify" }, zh: "核验", en: "Verify" },
  { key: "running", patch: { status: "running" }, zh: "运行中", en: "Running" },
  { key: "needs_action", patch: { status: "needs_action" }, zh: "需要处理", en: "Needs action" },
  { key: "done", patch: { status: "done" }, zh: "已完成", en: "Done" },
];

function readFiltersFromUrl(): HistoryFilters {
  if (typeof window === "undefined") return DEFAULT_FILTERS;
  const params = new URLSearchParams(window.location.search);
  return {
    q: params.get("q") ?? "",
    kind: (params.get("kind") as HistoryKind) || "all",
    status: (params.get("status") as HistoryStatus) || "all",
    range: (params.get("range") as HistoryRange) || "all",
    projectId: params.get("projectId") ?? "",
    evidence: (params.get("evidence") as EvidenceFilter) || "all",
  };
}

function filtersToParams(filters: HistoryFilters, locale: string, cursor?: string | null) {
  const params = new URLSearchParams({ locale, limit: "30" });
  if (filters.q.trim()) params.set("q", filters.q.trim());
  if (filters.kind !== "all") params.set("kind", filters.kind);
  if (filters.status !== "all") params.set("status", filters.status);
  if (filters.range !== "all") params.set("range", filters.range);
  if (filters.projectId) params.set("projectId", filters.projectId);
  if (filters.evidence !== "all") params.set("evidence", filters.evidence);
  if (cursor) params.set("cursor", cursor);
  return params;
}

function writeFiltersToUrl(filters: HistoryFilters) {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams();
  if (filters.q.trim()) params.set("q", filters.q.trim());
  if (filters.kind !== "all") params.set("kind", filters.kind);
  if (filters.status !== "all") params.set("status", filters.status);
  if (filters.range !== "all") params.set("range", filters.range);
  if (filters.projectId) params.set("projectId", filters.projectId);
  if (filters.evidence !== "all") params.set("evidence", filters.evidence);
  const query = params.toString();
  const next = query ? `${window.location.pathname}?${query}` : window.location.pathname;
  window.history.replaceState(null, "", next);
}

function dateLabel(value: string, locale: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function statusTone(status: string) {
  if (status === "done") return "bg-emerald-50 text-emerald-700 ring-emerald-100";
  if (status === "error" || status === "canceled") return "bg-red-50 text-red-700 ring-red-100";
  if (status === "running" || status === "retrying") return "bg-blue-50 text-blue-700 ring-blue-100";
  return "bg-amber-50 text-amber-800 ring-amber-100";
}

function statusDot(status: string) {
  if (status === "done") return "bg-emerald-500";
  if (status === "error" || status === "canceled") return "bg-red-500";
  if (status === "running" || status === "retrying") return "bg-blue-500";
  return "bg-amber-500";
}

export default function HistoryPage() {
  const { locale, t } = useI18n();
  const [filters, setFilters] = useState<HistoryFilters>(DEFAULT_FILTERS);
  const [items, setItems] = useState<HistoryItem[] | null>(null);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setFilters(readFiltersFromUrl());
    setHydrated(true);
  }, []);

  const fetchHistory = useCallback(async (cursor: string | null = null, append = false) => {
    setError("");
    if (!append) setItems(null);
    try {
      const response = await fetch(`/api/history?${filtersToParams(filters, locale, cursor).toString()}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
      setItems((current) => append ? [...(current ?? []), ...(payload.runs ?? [])] : (payload.runs ?? []));
      setProjects(payload.projects ?? []);
      setNextCursor(payload.nextCursor ?? null);
    } catch (e) {
      setError((e as Error).message);
      if (!append) setItems([]);
    }
  }, [filters, locale]);

  useEffect(() => {
    if (!hydrated) return;
    writeFiltersToUrl(filters);
    fetchHistory();
  }, [filters, fetchHistory, hydrated]);

  const hasFilters = useMemo(() => (
    filters.q.trim() || filters.kind !== "all" || filters.status !== "all" || filters.range !== "all" || filters.projectId || filters.evidence !== "all"
  ), [filters]);

  const copy = locale === "en" ? {
    searchPlaceholder: "Search role, candidate, query, or evidence summary",
    filters: "Filters",
    moreFilters: "More filters",
    clear: "Clear",
    type: "Type",
    status: "Status",
    time: "Time",
    role: "Role",
    evidence: "Evidence",
    allRoles: "All roles",
    all: "All",
    search: "Search",
    verify: "Verify",
    today: "Today",
    sevenDays: "7 days",
    thirtyDays: "30 days",
    highConfidence: "High confidence",
    needsVerification: "Needs verification",
    lowEvidence: "Low evidence",
    hasGaps: "Has evidence gaps",
    shortlistReady: "Shortlist ready",
    noMatchesTitle: "No matching research history",
    noMatchesDesc: "Clear filters or broaden the keyword to find more runs.",
    resultCount: "runs",
    loadMore: "Load more",
    projectFallback: "No role",
    candidates: "candidates",
    high: "high confidence",
    verifyNeeded: "need verification",
    gaps: "gaps",
  } : {
    searchPlaceholder: "搜索岗位、候选人、查询词或证据摘要",
    filters: "筛选",
    moreFilters: "更多筛选",
    clear: "清空",
    type: "类型",
    status: "状态",
    time: "时间",
    role: "Role",
    evidence: "证据",
    allRoles: "全部岗位",
    all: "全部",
    search: "搜人",
    verify: "核验",
    today: "今天",
    sevenDays: "7 天",
    thirtyDays: "30 天",
    highConfidence: "高置信",
    needsVerification: "待核验",
    lowEvidence: "低证据",
    hasGaps: "有证据缺口",
    shortlistReady: "可交付名单",
    noMatchesTitle: "没有匹配的历史记录",
    noMatchesDesc: "清空筛选或放宽关键词后再试。",
    resultCount: "条记录",
    loadMore: "加载更多",
    projectFallback: "无岗位",
    candidates: "候选人",
    high: "高置信",
    verifyNeeded: "待核验",
    gaps: "缺口",
  };

  const setFilter = (patch: Partial<HistoryFilters>) => setFilters((current) => ({ ...current, ...patch }));
  const clearFilters = () => setFilters(DEFAULT_FILTERS);

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow={t("history.eyebrow")}
        title={t("history.title")}
        description={t("history.desc")}
      />

      <Surface className="space-y-4 p-4">
        <label className="flex min-h-12 items-center gap-3 rounded-2xl border border-black/10 bg-white px-4">
          <FiSearch className="h-4 w-4 shrink-0 text-neutral-400" aria-hidden="true" />
          <input
            value={filters.q}
            onChange={(event) => setFilter({ q: event.target.value })}
            placeholder={copy.searchPlaceholder}
            className="min-w-0 flex-1 bg-transparent text-sm text-[var(--sh-ink)] outline-none placeholder:text-neutral-400"
          />
          {filters.q && (
            <button type="button" onClick={() => setFilter({ q: "" })} className="rounded-full p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700" aria-label={copy.clear}>
              <FiX className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </label>

        <div className="flex flex-wrap items-center gap-2">
          {QUICK_FILTERS.map((item) => {
            const active = Object.entries(item.patch).every(([key, value]) => filters[key as keyof HistoryFilters] === value);
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setFilter(item.patch)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition ${
                  active ? "bg-neutral-950 text-white ring-neutral-950" : "bg-white text-neutral-600 ring-black/10 hover:bg-neutral-50"
                }`}
              >
                {locale === "en" ? item.en : item.zh}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreOpen((value) => !value)}
            className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 ring-1 ring-black/10 hover:bg-neutral-50"
          >
            <FiFilter className="h-3.5 w-3.5" aria-hidden="true" />
            {copy.moreFilters}
          </button>
          {hasFilters && (
            <button type="button" onClick={clearFilters} className="rounded-full px-3 py-1.5 text-xs font-semibold text-neutral-500 hover:bg-neutral-100">
              {copy.clear}
            </button>
          )}
        </div>

        {moreOpen && (
          <div className="grid gap-3 border-t border-black/10 pt-4 md:grid-cols-2 xl:grid-cols-4">
            <FilterSelect label={copy.type} value={filters.kind} onChange={(value) => setFilter({ kind: value as HistoryKind })} options={[
              ["all", copy.all], ["search", copy.search], ["verify", copy.verify],
            ]} />
            <FilterSelect label={copy.status} value={filters.status} onChange={(value) => setFilter({ status: value as HistoryStatus })} options={[
              ["all", copy.all], ["queued", locale === "en" ? "Queued" : "排队中"], ["running", locale === "en" ? "Running" : "运行中"],
              ["retrying", locale === "en" ? "Retrying" : "重试中"], ["done", locale === "en" ? "Done" : "已完成"],
              ["error", locale === "en" ? "Failed" : "失败"], ["canceled", locale === "en" ? "Canceled" : "已取消"],
              ["needs_action", locale === "en" ? "Needs action" : "需要处理"],
            ]} />
            <FilterSelect label={copy.time} value={filters.range} onChange={(value) => setFilter({ range: value as HistoryRange })} options={[
              ["all", copy.all], ["today", copy.today], ["7d", copy.sevenDays], ["30d", copy.thirtyDays],
            ]} />
            <FilterSelect label={copy.role} value={filters.projectId} onChange={(value) => setFilter({ projectId: value })} options={[
              ["", copy.allRoles], ...projects.map((project) => [project.id, project.name] as [string, string]),
            ]} />
            <FilterSelect label={copy.evidence} value={filters.evidence} onChange={(value) => setFilter({ evidence: value as EvidenceFilter })} options={[
              ["all", copy.all], ["high_confidence", copy.highConfidence], ["needs_verification", copy.needsVerification],
              ["low_evidence", copy.lowEvidence], ["has_gaps", copy.hasGaps], ["shortlist_ready", copy.shortlistReady],
            ]} />
          </div>
        )}
      </Surface>

      {error && (
        <p className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">{t("common.errorPrefix")}: {error}</p>
      )}

      {items === null && !error && (
        <LoadingState title={t("history.load")} description={t("history.loadDesc")} />
      )}

      {items && items.length === 0 && (
        <EmptyState
          title={hasFilters ? copy.noMatchesTitle : t("history.emptyTitle")}
          description={hasFilters ? copy.noMatchesDesc : t("history.emptyDesc")}
          action={hasFilters ? (
            <SecondaryAction onClick={clearFilters}><FiX className="h-4 w-4" aria-hidden="true" />{copy.clear}</SecondaryAction>
          ) : (
            <div className="flex flex-wrap justify-center gap-2">
              <PrimaryAction href="/app/search"><FiSearch className="h-4 w-4" aria-hidden="true" />{t("nav.search")}</PrimaryAction>
              <SecondaryAction href="/app/verify"><FiCheckCircle className="h-4 w-4" aria-hidden="true" />{t("history.verifyCandidate")}</SecondaryAction>
            </div>
          )}
        />
      )}

      {items && items.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3 text-xs text-[var(--sh-muted)]">
            <span>{items.length} {copy.resultCount}</span>
            <button type="button" onClick={() => fetchHistory()} className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 hover:bg-neutral-100">
              <FiRefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              {locale === "en" ? "Refresh" : "刷新"}
            </button>
          </div>
          <ul className="space-y-2">
            {items.map((h) => (
              <li key={h.id}>
                <Link
                  href={h.next_action.href}
                  className="block rounded-3xl border border-black/10 bg-white/84 px-4 py-4 transition hover:border-black/20 hover:shadow-sm"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge
                          label={h.kind === "verify" ? t("kind.verify") : t("kind.search")}
                          dotClassName={h.kind === "verify" ? "bg-amber-500" : "bg-blue-500"}
                          className={h.kind === "verify" ? "bg-amber-50 text-amber-800 ring-amber-100" : "bg-blue-50 text-blue-700 ring-blue-100"}
                        />
                        <StatusBadge label={h.status_label} dotClassName={statusDot(h.status)} className={statusTone(h.status)} />
                        {h.needs_action && (
                          <StatusBadge label={locale === "en" ? "Needs action" : "需要处理"} dotClassName="bg-red-500" className="bg-red-50 text-red-700 ring-red-100" />
                        )}
                      </div>
                      <p className="truncate text-sm font-semibold text-[var(--sh-ink)]" title={h.query_text}>{h.label}</p>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--sh-muted)]">
                        <span className="inline-flex items-center gap-1.5"><FiClock className="h-3.5 w-3.5" aria-hidden="true" />{dateLabel(h.updated_at, locale)}</span>
                        <span>{h.project_name || copy.projectFallback}</span>
                        {h.summary && <span className="max-w-full truncate">{h.summary}</span>}
                      </div>
                      {h.evidence_summary && (
                        <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-600">
                          <span>{h.evidence_summary.candidate_count} {copy.candidates}</span>
                          <span>{h.evidence_summary.high_confidence_count} {copy.high}</span>
                          <span>{h.evidence_summary.needs_verification_count} {copy.verifyNeeded}</span>
                          {h.evidence_summary.primary_gaps.length > 0 && (
                            <span className="inline-flex items-center gap-1 text-amber-700">
                              <FiAlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
                              {h.evidence_summary.primary_gaps.length} {copy.gaps}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-neutral-900">
                      {h.next_action.label}
                      <FiChevronRight className="h-4 w-4" aria-hidden="true" />
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          {nextCursor && (
            <div className="flex justify-center pt-2">
              <SecondaryAction onClick={() => fetchHistory(nextCursor, true)}>{copy.loadMore}</SecondaryAction>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-neutral-500">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-10 w-full rounded-2xl border border-black/10 bg-white px-3 text-sm text-[var(--sh-ink)] outline-none focus:border-black/20"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>{optionLabel}</option>
        ))}
      </select>
    </label>
  );
}
