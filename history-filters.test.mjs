import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildHistoryFilterChips,
  buildHistoryRunView,
  historyRangeStart,
  matchesHistoryEvidenceFilter,
  normalizeHistoryFilters,
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
    evidence: "has_gaps",
    limit: "500",
  });

  assert.equal(filters.q, "founder");
  assert.equal(filters.kind, "search");
  assert.equal(filters.status, "all");
  assert.equal(filters.needsAction, true);
  assert.equal(filters.evidence, "has_gaps");
  assert.equal(filters.limit, 100);
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
  });
  const chips = buildHistoryFilterChips(filters, [{ id: "project-1", name: "AI Growth" }], { locale: "en" });

  assert.deepEqual(chips.map((chip) => chip.key), ["q", "kind", "status", "range", "projectId", "evidence"]);
  assert.deepEqual(chips.map((chip) => chip.label), [
    "Keyword: founder",
    "Type: Verify",
    "Status: Needs action",
    "Time: 7 days",
    "Role: AI Growth",
    "Evidence: Has evidence gaps",
  ]);
  assert.deepEqual(chips.find((chip) => chip.key === "status")?.clearPatch, { status: "all", needsAction: "" });
  assert.deepEqual(chips.find((chip) => chip.key === "projectId")?.clearPatch, { projectId: "" });
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
  assert.equal(run.needs_action, true);
  assert.match(run.needs_action_reasons.join(" / "), /Candidates need verification/);
  assert.equal(matchesHistoryEvidenceFilter(run, "high_confidence"), true);
  assert.equal(matchesHistoryEvidenceFilter(run, "needs_verification"), true);
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

test("history API and page expose server-side filters and evidence entry points", () => {
  const apiRoute = readFileSync("web/app/api/history/route.ts", "utf8");
  const db = readFileSync("web/lib/db.ts", "utf8");
  const page = readFileSync("web/app/app/history/page.tsx", "utf8");

  assert.match(apiRoute, /historyRuns\(user\.id, url\.searchParams, locale\)/);
  assert.match(apiRoute, /listProjects\(user\.id\)/);
  assert.doesNotMatch(apiRoute, /recentRuns\(user\.id, 20\)/);
  assert.match(db, /r\.status =/);
  assert.match(db, /r\.label ILIKE/);
  assert.match(db, /LEFT JOIN projects/);
  assert.match(page, /writeFiltersToUrl/);
  assert.match(page, /buildHistoryFilterChips/);
  assert.match(page, /activeFilterChips/);
  assert.match(page, /min-h-9/);
  assert.match(page, /projectId/);
  assert.match(page, /high_confidence/);
  assert.match(page, /needs_action_reasons/);
  assert.match(page, /next_action\.href/);
});
