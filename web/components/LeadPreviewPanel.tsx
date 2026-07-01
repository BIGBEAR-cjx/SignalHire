"use client";

import { useMemo, useState } from "react";
import { FiSearch } from "react-icons/fi";
import { buildLeadPreviewConstraint } from "@/lib/lead-preview-feedback.mjs";
import type { LeadPreviewConstraint, LeadPreviewView } from "@/lib/lead-preview";
import { sourceTypeLabel, sourceTypeTooltip } from "@/lib/source-classifier.mjs";
import { PrimaryAction, SecondaryAction, Surface } from "@/components/ui/signal-ui";

function copy(locale: "zh" | "en") {
  return locale === "en" ? {
    eyebrow: "Profile Lead Layer",
    title: "Unverified profile leads found while research is running",
    desc: "These are profile leads, not recommendations. SignalHire still needs a public evidence packet and contact provenance before outreach.",
    waiting: "No preview leads yet. The agent will show source-level leads here before the final shortlist is ready.",
    completed: "Verified results are available. Use the shortlist and candidate evidence packet instead of preview leads.",
    missing: "Missing evidence",
    reason: "Possible match",
    next: "Next verification step",
    notRelevant: "Not relevant",
    notRelevantReason: "Not relevant to this role",
    applied: "Added to next-search constraints",
    nextSearch: "Run next search with constraints",
    source: "Source",
    noOutreach: "Outreach disabled until evidence and contact provenance are verified.",
    previewLeads: "Preview leads",
    profileLeads: "Profile leads",
    evidenceSources: "Evidence-like sources",
    outreachBlocked: "Outreach blocked",
    provenanceUnverified: "evidence/contact unverified",
    blockedReason: "Preview outreach is disabled until public evidence and contact provenance are verified.",
  } : {
    eyebrow: "Profile Lead Layer / 资料线索层",
    title: "研究进行中发现的未核验资料线索",
    desc: "这些只是 profile leads，不是推荐名单。SignalHire 仍需要补齐公开证据包和联系方式来源后，才允许外联。",
    waiting: "暂时还没有 preview lead。Agent 会在最终 shortlist 前先把来源级线索显示在这里。",
    completed: "已经有核验后的结果，请优先查看 shortlist 和候选人证据包。",
    missing: "缺失证据",
    reason: "可能匹配原因",
    next: "下一步核验",
    notRelevant: "不相关",
    notRelevantReason: "不符合当前岗位",
    applied: "已加入下一轮搜索约束",
    nextSearch: "带约束开启下一轮搜索",
    source: "来源",
    noOutreach: "证据和联系方式来源未核验前，不能外联。",
    previewLeads: "预览线索",
    profileLeads: "资料线索",
    evidenceSources: "证据型来源",
    outreachBlocked: "外联已阻断",
    provenanceUnverified: "证据/联系方式未核验",
    blockedReason: "公开证据和联系方式来源核验前，预览线索不能外联。",
  };
}

function sourceClassName(sourceType: string) {
  if (sourceType === "github") return "bg-gray-950 text-white ring-gray-950";
  if (sourceType === "paper") return "bg-blue-50 text-blue-700 ring-blue-100";
  if (sourceType === "company_page") return "bg-emerald-50 text-emerald-700 ring-emerald-100";
  if (sourceType === "people_api") return "bg-amber-50 text-amber-800 ring-amber-100";
  return "bg-white text-gray-700 ring-black/10";
}

export default function LeadPreviewPanel({
  view,
  locale,
  projectId,
  baseSearchInput = "",
  onConstraint,
}: {
  view?: LeadPreviewView | null;
  locale: "zh" | "en";
  projectId?: string;
  baseSearchInput?: string;
  onConstraint?: (constraint: LeadPreviewConstraint) => void;
}) {
  const c = copy(locale);
  const [constraints, setConstraints] = useState<LeadPreviewConstraint[]>([]);
  const items = view?.items ?? [];
  const status = view?.status ?? "waiting_for_leads";
  const nextSearchInput = useMemo(() => {
    const additions = constraints.map((constraint) => constraint.next_search_instruction).filter(Boolean);
    return [baseSearchInput.trim(), additions.length ? `Negative constraints:\n${additions.join("\n")}` : ""].filter(Boolean).join("\n\n");
  }, [baseSearchInput, constraints]);
  const nextSearchHref = projectId && nextSearchInput
    ? `/app/search?project=${encodeURIComponent(projectId)}&q=${encodeURIComponent(nextSearchInput)}`
    : "";

  function markNotRelevant(item: LeadPreviewView["items"][number]) {
    const constraint = buildLeadPreviewConstraint({ lead: item, reason: c.notRelevantReason });
    setConstraints((prev) => prev.some((entry) => entry.lead_id === constraint.lead_id) ? prev : [...prev, constraint]);
    onConstraint?.(constraint);
  }

  if (!view || (status === "verified_results_available" && items.length === 0)) return null;
  const summary = view.summary;

  return (
    <Surface className="space-y-4 p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">{c.eyebrow}</p>
          <h2 className="mt-1 text-base font-semibold text-[var(--sh-ink)]">{c.title}</h2>
          <p className="mt-1 text-sm leading-6 text-[var(--sh-muted)]">{c.desc}</p>
        </div>
        {nextSearchHref && constraints.length > 0 && (
          <PrimaryAction href={nextSearchHref} className="min-h-9 px-3 py-2 text-xs">
            <FiSearch className="h-3.5 w-3.5" aria-hidden="true" />
            {c.nextSearch}
          </PrimaryAction>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--sh-muted)]">
        <span className="rounded-full bg-white/70 px-2.5 py-1 ring-1 ring-black/10">
          {c.previewLeads}: <strong className="text-[var(--sh-ink)]">{summary.item_count}</strong>
        </span>
        <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-800 ring-1 ring-amber-100">
          {c.profileLeads}: <strong>{summary.profile_lead_count}</strong>
        </span>
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-800 ring-1 ring-emerald-100">
          {c.evidenceSources}: <strong>{summary.evidence_source_count}</strong>
        </span>
        <span
          title={c.blockedReason}
          aria-label={c.blockedReason}
          className="rounded-full bg-gray-50 px-2.5 py-1 text-gray-700 ring-1 ring-black/10"
        >
          {c.outreachBlocked}: <strong>{c.provenanceUnverified}</strong>
          <span className="sr-only">. {c.blockedReason}</span>
        </span>
      </div>

      {items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-black/10 bg-white/60 p-4 text-sm leading-6 text-[var(--sh-muted)]">
          {status === "verified_results_available" ? c.completed : c.waiting}
        </p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {items.slice(0, 6).map((item) => {
            const applied = constraints.some((constraint) => constraint.lead_id === item.id);
            return (
              <div key={item.id} className="rounded-2xl border border-black/10 bg-white/80 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[var(--sh-ink)]">{item.candidate_name}</p>
                    <p className="mt-1 truncate text-xs text-[var(--sh-muted)]">{[item.headline, item.company].filter(Boolean).join(" · ") || item.label}</p>
                  </div>
                  <span
                    title={sourceTypeTooltip(item.source_type, locale)}
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${sourceClassName(item.source_type)}`}
                  >
                    {sourceTypeLabel(item.source_type, locale)}
                  </span>
                </div>
                {item.possible_match_reason && (
                  <p className="mt-3 text-xs leading-5 text-[var(--sh-muted)]">
                    <span className="font-semibold text-[var(--sh-ink)]">{c.reason}: </span>{item.possible_match_reason}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  {item.missing_evidence.map((evidence) => (
                    <span key={evidence} className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 ring-1 ring-amber-100">
                      {c.missing}: {evidence}
                    </span>
                  ))}
                </div>
                <p className="mt-3 text-xs leading-5 text-[var(--sh-muted)]">{c.next}: {item.next_verification_step}</p>
                <p
                  data-can-outreach={item.can_outreach ? "true" : "false"}
                  className="mt-2 rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-600 ring-1 ring-black/5"
                >
                  {item.can_outreach ? "" : c.noOutreach}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {item.source_url && (
                    <SecondaryAction href={item.source_url} className="min-h-8 px-3 py-1.5 text-xs">
                      {c.source}
                    </SecondaryAction>
                  )}
                  <button
                    type="button"
                    onClick={() => markNotRelevant(item)}
                    disabled={applied}
                    className="min-h-8 rounded-xl bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 ring-1 ring-black/10 hover:bg-gray-50 disabled:opacity-60"
                  >
                    {applied ? c.applied : c.notRelevant}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Surface>
  );
}
