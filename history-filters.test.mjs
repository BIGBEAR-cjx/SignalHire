import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildHistoryFilterChips,
  buildHistoryFacetCounts,
  buildHistoryRunView,
  buildSavedHistoryView,
  historyRangeStart,
  matchesHistoryEvidenceFilter,
  normalizeHistoryGapType,
  normalizeHistoryFilters,
  parseSavedHistoryViews,
  serializeSavedHistoryViews,
} from "./web/lib/history.mjs";

const talentSearchResult = {
  search_brief: { original_query: "Find AI growth lead" },
  evidence_graph: {
    source_mix: [
      { source_type: "profile", count: 2 },
      { source_type: "code", count: 1 },
    ],
  },
  candidates: [
    {
      name: "Ada Growth",
      headline: "AI Growth Lead",
      match_score: 92,
      strongest_signals: ["Built AI growth loops"],
      claims: [
        { claim: "AI growth work", verdict: "verified", evidence: [{ url: "https://example.com/a", source_type: "profile" }] },
        { claim: "Open source AI tooling", verdict: "verified", evidence: [{ url: "https://github.com/example", source_type: "code" }] },
      ],
      evidence_audit: {
        overall_evidence_quality: "high",
      },
      status: "outreach_drafted",
      outreach_draft: "Hi Ada, your AI growth loop work looked relevant.",
    },
    {
      name: "Ben Maybe",
      headline: "Growth PM",
      match_score: 71,
      uncertainties: ["Recent AI work is unclear"],
      claims: [
        { claim: "LLM launch ownership", verdict: "unverified", evidence: [] },
      ],
      evidence_audit: {
        overall_evidence_quality: "low",
      },
    },
  ],
};

test("normalizes history filters and date ranges", () => {
  const filters = normalizeHistoryFilters({
    q: " founder ",
    kind: "search",
    status: "needs_action",
    range: "7d",
    evidence: "has_outreach_drafts",
    gap: "工作经历",
    limit: "500",
  });

  assert.equal(filters.q, "founder");
  assert.equal(filters.kind, "search");
  assert.equal(filters.status, "all");
  assert.equal(filters.needsAction, true);
  assert.equal(filters.evidence, "has_outreach_drafts|gap:work_history");
  assert.equal(filters.evidenceFilter, "has_outreach_drafts");
  assert.equal(filters.gap, "work_history");
  assert.equal(filters.limit, 100);
  assert.equal(normalizeHistoryGapType("Public voice"), "public_voice");
  assert.match(historyRangeStart("7d", new Date("2026-06-23T12:00:00.000Z")), /^2026-06-16T12:00:00\.000Z$/);
});

test("builds removable active history filter chips", () => {
  const filters = normalizeHistoryFilters({
    q: " founder ",
    kind: "verify",
    status: "needs_action",
    range: "7d",
    projectId: "project-1",
    evidence: "has_gaps",
    gap: "practice",
  });
  const chips = buildHistoryFilterChips(filters, [{ id: "project-1", name: "AI Growth" }], { locale: "en" });

  assert.deepEqual(chips.map((chip) => chip.key), ["q", "kind", "status", "range", "projectId", "evidence", "gap"]);
  assert.deepEqual(chips.map((chip) => chip.label), [
    "Keyword: founder",
    "Type: Verify",
    "Status: Needs action",
    "Time: 7 days",
    "Role: AI Growth",
    "Evidence: Has evidence gaps",
    "Gap type: Practice",
  ]);
  assert.deepEqual(chips.find((chip) => chip.key === "status")?.clearPatch, { status: "all", needsAction: "" });
  assert.deepEqual(chips.find((chip) => chip.key === "projectId")?.clearPatch, { projectId: "" });
  assert.deepEqual(chips.find((chip) => chip.key === "gap")?.clearPatch, { gap: "" });
});

test("builds history run next actions and evidence summaries", () => {
  const run = buildHistoryRunView({
    id: "run-1",
    kind: "search",
    status: "done",
    label: "AI Growth Lead",
    summary: "2 candidates",
    query_text: "Find AI growth lead",
    project_id: "project-1",
    project_name: "AI Growth",
    search_task_id: "task-1",
    created_at: "2026-06-20T10:00:00.000Z",
    updated_at: "2026-06-21T10:00:00.000Z",
    finished_at: "2026-06-21T10:02:00.000Z",
    result: talentSearchResult,
  }, { locale: "en" });

  assert.equal(run.next_action.href, "/app/projects/project-1");
  assert.equal(run.next_action.label, "Continue role");
  assert.equal(run.evidence_summary.candidate_count, 2);
  assert.equal(run.evidence_summary.high_confidence_count, 1);
  assert.equal(run.evidence_summary.needs_verification_count, 1);
  assert.deepEqual(run.evidence_summary.gap_types, ["research", "public_voice"]);
  assert.equal(run.evidence_summary.outreach_draft_count, 1);
  assert.equal(run.evidence_summary.has_outreach_drafts, true);
  assert.equal(run.needs_action, true);
  assert.match(run.needs_action_reasons.join(" / "), /Candidates need verification/);
  assert.match(run.needs_action_reasons.join(" / "), /Low-evidence candidates/);
  assert.equal(matchesHistoryEvidenceFilter(run, "high_confidence"), true);
  assert.equal(matchesHistoryEvidenceFilter(run, "needs_verification"), true);
  assert.equal(matchesHistoryEvidenceFilter(run, "has_outreach_drafts"), true);
  assert.equal(matchesHistoryEvidenceFilter(run, "all|gap:public_voice"), true);
  assert.equal(matchesHistoryEvidenceFilter(run, "all|gap:practice"), false);
});

test("builds needs action reasons for failed and canceled runs", () => {
  const failed = buildHistoryRunView({
    id: "run-failed",
    kind: "search",
    status: "error",
    label: "AI Growth Lead",
    query_text: "Find AI growth lead",
    updated_at: "2026-06-21T10:00:00.000Z",
  }, { locale: "en" });
  const canceled = buildHistoryRunView({
    id: "run-canceled",
    kind: "verify",
    status: "canceled",
    label: "Candidate check",
    query_text: "Ada Growth",
    updated_at: "2026-06-21T10:00:00.000Z",
  }, { locale: "en" });

  assert.equal(failed.needs_action, true);
  assert.deepEqual(failed.needs_action_reasons, ["Failed run"]);
  assert.equal(canceled.needs_action, true);
  assert.deepEqual(canceled.needs_action_reasons, ["Canceled run"]);
});

test("builds history facet counts from run views", () => {
  const searchRun = buildHistoryRunView({
    id: "run-search",
    kind: "search",
    status: "done",
    label: "AI Growth Lead",
    query_text: "Find AI growth lead",
    updated_at: "2026-06-21T10:00:00.000Z",
    result: talentSearchResult,
  }, { locale: "en" });
  const failedRun = buildHistoryRunView({
    id: "run-failed",
    kind: "verify",
    status: "error",
    label: "Candidate check",
    query_text: "Ada Growth",
    updated_at: "2026-06-21T10:00:00.000Z",
  }, { locale: "en" });

  const facets = buildHistoryFacetCounts([searchRun, failedRun]);

  assert.equal(facets.status.done, 1);
  assert.equal(facets.status.error, 1);
  assert.equal(facets.kind.search, 1);
  assert.equal(facets.kind.verify, 1);
  assert.equal(facets.evidence.high_confidence, 1);
  assert.equal(facets.evidence.needs_verification, 1);
  assert.equal(facets.evidence.low_evidence, 1);
  assert.equal(facets.evidence.has_gaps, 1);
  assert.equal(facets.evidence.shortlist_ready, 1);
  assert.equal(facets.evidence.has_outreach_drafts, 1);
  assert.equal(facets.gap.research, 1);
  assert.equal(facets.gap.public_voice, 1);
  assert.equal(facets.needs_action, 2);
});

test("serializes local saved history views with stable filter fields", () => {
  const saved = buildSavedHistoryView(" Needs action ", {
    q: " founder ",
    kind: "search",
    status: "needs_action",
    range: "7d",
    projectId: "project-1",
    evidence: "has_gaps",
    gap: "Public voice",
  }, { now: "2026-07-01T00:00:00.000Z", id: "view-1" });
  const parsed = parseSavedHistoryViews(serializeSavedHistoryViews([saved]));

  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].id, "view-1");
  assert.equal(parsed[0].name, "Needs action");
  assert.deepEqual(parsed[0].filters, {
    q: "founder",
    kind: "search",
    status: "needs_action",
    range: "7d",
    projectId: "project-1",
    evidence: "has_gaps",
    gap: "public_voice",
  });
  assert.equal(parsed[0].created_at, "2026-07-01T00:00:00.000Z");
  assert.deepEqual(parseSavedHistoryViews("not-json"), []);
});

test("history API and page expose server-side filters, facets, and saved views", () => {
  const apiRoute = readFileSync("web/app/api/history/route.ts", "utf8");
  const db = readFileSync("web/lib/db.ts", "utf8");
  const page = readFileSync("web/app/app/history/page.tsx", "utf8");

  assert.match(apiRoute, /historyRuns\(user\.id, url\.searchParams, locale\)/);
  assert.match(apiRoute, /listProjects\(user\.id\)/);
  assert.match(apiRoute, /facetCounts/);
  assert.doesNotMatch(apiRoute, /recentRuns\(user\.id, 20\)/);
  assert.match(db, /r\.status =/);
  assert.match(db, /r\.label ILIKE/);
  assert.match(db, /LEFT JOIN projects/);
  assert.match(db, /facetCounts/);
  assert.match(db, /async function historyFacetCounts\(/);
  assert.match(db, /const facetCounts = await historyFacetCounts\(/);
  assert.match(db, /buildHistoryFacetCounts\(facetViews\)/);
  assert.doesNotMatch(db, /const facetCounts = buildHistoryFacetCounts\(baseViews\)/);
  assert.match(page, /writeFiltersToUrl/);
  assert.match(page, /buildHistoryFilterChips/);
  assert.match(page, /HISTORY_SAVED_VIEWS_STORAGE_KEY/);
  assert.match(page, /localStorage\.getItem/);
  assert.match(page, /localStorage\.setItem/);
  assert.match(page, /serializeSavedHistoryViews/);
  assert.match(page, /parseSavedHistoryViews/);
  assert.match(page, /const SAVED_VIEW_INLINE_LIMIT = 4/);
  assert.match(page, /savedViews\.slice\(0, SAVED_VIEW_INLINE_LIMIT\)/);
  assert.match(page, /savedViews\.slice\(SAVED_VIEW_INLINE_LIMIT\)/);
  assert.match(page, /overflowSavedViews\.length > 0/);
  assert.match(page, /aria-expanded=\{savedViewsOverflowOpen\}/);
  assert.match(page, /history-saved-views-overflow/);
  assert.match(page, /facetScopeHint/);
  assert.match(page, /setSavedViewsOverflowOpen\(false\)/);
  assert.match(page, /max-h-44/);
  assert.match(page, /overflow-y-auto/);
  assert.match(page, /facetCounts/);
  assert.match(page, /formatCountLabel/);
  assert.match(page, /activeFilterChips/);
  assert.match(page, /min-h-9/);
  assert.match(page, /projectId/);
  assert.match(page, /high_confidence/);
  assert.match(page, /has_outreach_drafts/);
  assert.match(page, /gapType/);
  assert.match(page, /params\.set\("gap"/);
  assert.match(page, /needs_action_reasons/);
  assert.match(page, /next_action\.href/);
});
