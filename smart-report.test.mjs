import test from "node:test";
import assert from "node:assert/strict";
import { attachClientDeliveryLoopSnapshot, buildClientDeliverySnapshot, buildClientDeliveryVersionHistory, buildClientDeliveryWeeklyArchive, buildSmartReportView } from "./web/lib/smart-report.mjs";
import { normalizeTalentSearchResult } from "./web/lib/talent-profile.mjs";

test("builds a client-ready smart report with source mix, risks, and next actions", () => {
  const report = buildSmartReportView({
    search_brief: { original_query: "Hire an AI infra lead" },
    evidence_graph: {
      source_mix: [
        { source_type: "github", count: 2 },
        { source_type: "people_api", count: 1 },
      ],
    },
    candidates: [
      {
        name: "Ada",
        headline: "AI Infra Lead",
        match_score: 88,
        strongest_signals: ["Built vLLM deployment"],
        uncertainties: [],
        evidence_audit: {
          overall_evidence_quality: "high",
          risk_flags: [],
          unverified_claims: [],
        },
      },
      {
        name: "Lin",
        headline: "ML Engineer",
        match_score: 71,
        strongest_signals: ["OpenJobs profile lead"],
        uncertainties: ["Needs public evidence"],
        evidence_audit: {
          overall_evidence_quality: "low",
          risk_flags: ["OpenJobs profile has not been independently verified"],
          unverified_claims: ["Profile provider claims"],
        },
      },
    ],
  }, { locale: "en" });

  assert.equal(report.title, "Smart Report");
  assert.equal(report.metrics.candidates, 2);
  assert.equal(report.metrics.strong_evidence, 1);
  assert.equal(report.metrics.ready_for_outreach, 1);
  assert.equal(report.metrics.needs_scheduling, 0);
  assert.deepEqual(report.source_mix.map((item) => item.label), ["GitHub", "Profile lead"]);
  assert.equal(report.top_candidates[0].name, "Ada");
  assert.equal(report.top_candidates[0].outreach_status, "Not started");
  assert.match(report.top_candidates[0].next_action, /review/i);
  assert.match(report.top_candidates[1].next_action, /verify evidence/i);
  assert.match(report.risks.join(" "), /Lin/);
  assert.ok(report.next_actions.some((action) => /Share this report/i.test(action)));
});

test("adds client-safe referral path summary when network seeds are provided", () => {
  const report = buildSmartReportView({
    search_brief: { original_query: "Hire an AI infra lead" },
    network_seeds: [{
      name: "Grace",
      company: "Example AI",
      email: "grace@example.com",
      private_notes: "private customer note",
    }],
    candidates: [{
      name: "Ada",
      headline: "AI Infra Lead",
      current_company: "Example AI",
      match_score: 88,
      strongest_signals: ["Built vLLM deployment"],
      evidence_audit: { overall_evidence_quality: "high" },
    }],
  }, { locale: "en" });

  assert.equal(report.referral_summary.length, 1);
  assert.equal(report.referral_summary[0].candidate_name, "Ada");
  assert.match(report.referral_summary[0].shared_context, /Example AI/);
  assert.match(report.referral_summary[0].intro_snippet, /Ada/);
  assert.doesNotMatch(JSON.stringify(report.referral_summary), /grace@example\.com|private customer note/);
});

test("builds a shareable client delivery loop", () => {
  const report = buildSmartReportView({
    search_brief: { original_query: "Hire an AI platform engineer" },
    client_delivery_loop: {
      weekly_progress: {
        window_label: "This week",
        metrics: {
          new_candidates: 4,
          contacted: 3,
          replied: 2,
          interview_ready: 1,
          confirmed: 1,
        },
      },
      risks: ["Two candidates still need independent evidence.", "internal debug: role_agent_metrics payload hidden"],
      next_actions: ["Review interview-ready candidate with hiring manager.", "debug: inspect execution_log before sharing"],
    },
    candidates: [
      { name: "Ada", match_score: 90, evidence_quality: "high", outreach_status: "interview_ready" },
      { name: "Lin", match_score: 80, evidence_quality: "medium", outreach_status: "replied" },
    ],
  }, { locale: "en" });

  assert.equal(report.client_delivery_loop.title, "Client Delivery Loop");
  assert.equal(report.client_delivery_loop.weekly_progress.window_label, "This week");
  assert.deepEqual(report.client_delivery_loop.weekly_progress.metrics, {
    new_candidates: 4,
    contacted: 3,
    replied: 2,
    interview_ready: 1,
    confirmed: 1,
  });
  assert.match(report.client_delivery_loop.evidence_summary, /1 strong evidence/);
  assert.deepEqual(report.client_delivery_loop.risks, ["Two candidates still need independent evidence."]);
  assert.deepEqual(report.client_delivery_loop.next_actions, ["Review interview-ready candidate with hiring manager."]);
  assert.doesNotMatch(JSON.stringify(report.client_delivery_loop), /internal debug|execution_log|role_agent_metrics/);
});

test("attaches project delivery snapshot to a shareable smart report result", () => {
  const result = attachClientDeliveryLoopSnapshot({
    query: "Hire an AI platform engineer",
    candidates: [{ name: "Ada", match_score: 90, evidence_quality: "high" }],
  }, {
    weekly_progress: {
      window_label: "Last 7 days",
      metrics: {
        new_candidates: 3,
        contacted: 2,
        replied: 1,
        interview_ready: 1,
        confirmed: 1,
      },
    },
    risks: ["One candidate needs compensation alignment."],
    next_actions: ["Share interview-ready queue with hiring manager."],
  });

  const report = buildSmartReportView(normalizeTalentSearchResult(result), { locale: "en" });
  assert.equal(report.client_delivery_loop.weekly_progress.window_label, "Last 7 days");
  assert.equal(report.client_delivery_loop.weekly_progress.metrics.contacted, 2);
  assert.equal(report.client_delivery_loop.weekly_progress.metrics.confirmed, 1);
  assert.deepEqual(report.client_delivery_loop.risks, ["One candidate needs compensation alignment."]);
  assert.deepEqual(report.client_delivery_loop.next_actions, ["Share interview-ready queue with hiring manager."]);
});

test("builds client-safe delivery version history from project runs", () => {
  const history = buildClientDeliveryVersionHistory([
    {
      id: "run-3",
      kind: "search",
      label: "Week 3 delivery",
      summary: "Added two interview-ready candidates.",
      status: "complete",
      updated_at: "2026-07-03T08:00:00.000Z",
      clientDeliveryReportHref: "/r/run-3?lang=en&t=token-3",
      result: { candidates: [{ name: "Ada" }, { name: "Lin" }] },
    },
    {
      id: "run-2",
      kind: "search",
      label: "Week 2 delivery",
      summary: "debug: internal role_agent notes",
      status: "complete",
      updated_at: "2026-06-26T08:00:00.000Z",
      clientDeliveryReportHref: "/r/run-2?lang=en&t=token-2",
      result: { candidates: [{ name: "Grace" }] },
    },
    {
      id: "verify-1",
      kind: "verify",
      label: "Evidence audit",
      status: "complete",
      updated_at: "2026-06-20T08:00:00.000Z",
    },
  ], { currentRunId: "run-3", locale: "en" });

  assert.equal(history.title, "Delivery versions");
  assert.equal(history.items.length, 2);
  assert.deepEqual(history.items.map((item) => item.id), ["run-3", "run-2"]);
  assert.equal(history.items[0].is_current, true);
  assert.equal(history.items[0].candidate_count, 2);
  assert.equal(history.items[0].href, "/r/run-3?lang=en&t=token-3");
  assert.equal(history.items[1].summary, "");
  assert.doesNotMatch(JSON.stringify(history), /debug|role_agent|verify-1/);
});

test("builds a weekly client delivery archive from persisted report versions", () => {
  const archive = buildClientDeliveryWeeklyArchive([
    {
      id: "run-week-2b",
      kind: "search",
      label: "Week 2 delivery follow-up",
      summary: "Added one confirmed interview.",
      updated_at: "2026-07-03T08:00:00.000Z",
      clientDeliveryReportHref: "/r/run-week-2b?lang=en&t=token-2b",
      result: {
        client_delivery_loop: {
          weekly_progress: {
            window_label: "Week of Jun 29",
            metrics: { new_candidates: 4, contacted: 3, replied: 2, interview_ready: 1, confirmed: 1 },
          },
          risks: ["One candidate needs compensation alignment."],
          next_actions: ["Share confirmed interview with client."],
        },
        candidates: [{ name: "Ada", evidence_quality: "high" }],
      },
    },
    {
      id: "run-week-2a",
      kind: "search",
      label: "Week 2 delivery",
      summary: "debug: internal role_agent note",
      updated_at: "2026-07-01T08:00:00.000Z",
      clientDeliveryReportHref: "/r/run-week-2a?lang=en&t=token-2a",
      result: {
        client_delivery_loop: {
          weekly_progress: {
            window_label: "Week of Jun 29",
            metrics: { new_candidates: 3, contacted: 2, replied: 1, interview_ready: 1, confirmed: 0 },
          },
        },
        candidates: [{ name: "Lin", evidence_quality: "medium" }],
      },
    },
    {
      id: "run-week-1",
      kind: "search",
      label: "Week 1 delivery",
      summary: "Sourced first candidates.",
      updated_at: "2026-06-26T08:00:00.000Z",
      clientDeliveryReportHref: "/r/run-week-1?lang=en&t=token-1",
      result: {
        client_delivery_loop: {
          weekly_progress: {
            window_label: "Week of Jun 22",
            metrics: { new_candidates: 2, contacted: 1, replied: 0, interview_ready: 0, confirmed: 0 },
          },
        },
        candidates: [{ name: "Grace", evidence_quality: "low" }],
      },
    },
    { id: "verify-1", kind: "verify", updated_at: "2026-07-03T08:00:00.000Z" },
  ], { locale: "en" });

  assert.equal(archive.title, "Weekly delivery archive");
  assert.equal(archive.items.length, 2);
  assert.match(archive.items[0].archive_id, /^cda_[a-z0-9]+$/);
  assert.equal(archive.items[0].week_start, "2026-06-29");
  assert.equal(archive.items[0].week_end, "2026-07-05");
  assert.equal(archive.items[0].latest_report_id, "run-week-2b");
  assert.deepEqual(archive.items[0].metrics, { new_candidates: 4, contacted: 3, replied: 2, interview_ready: 1, confirmed: 1 });
  assert.deepEqual(archive.items[0].reports.map((item) => item.id), ["run-week-2b", "run-week-2a"]);
  assert.equal(archive.items[0].reports[1].summary, "");
  assert.deepEqual(archive.items[1].reports.map((item) => item.id), ["run-week-1"]);
  assert.doesNotMatch(JSON.stringify(archive), /debug|role_agent|verify-1/);
});

test("builds a frozen client delivery snapshot manifest from a report version", () => {
  const run = {
    id: "run-3",
    updated_at: "2026-07-03T08:00:00.000Z",
  };
  const result = {
    query: "Hire an AI platform engineer",
    client_delivery_loop: {
      weekly_progress: {
        window_label: "This week",
        metrics: {
          new_candidates: 4,
          contacted: 3,
          replied: 2,
          interview_ready: 1,
          confirmed: 1,
        },
      },
      risks: ["One candidate needs compensation alignment.", "debug: inspect role_agent state"],
      next_actions: ["Review interview-ready candidate.", "internal execution_log check"],
    },
    candidates: [
      { name: "Ada", match_score: 90, evidence_quality: "high", outreach_status: "interview_ready" },
      { name: "Lin", match_score: 80, evidence_quality: "medium", outreach_status: "replied" },
    ],
  };

  const snapshot = buildClientDeliverySnapshot(run, result, { locale: "en" });
  const sameSnapshot = buildClientDeliverySnapshot(run, result, { locale: "en" });
  const nextSnapshot = buildClientDeliverySnapshot({ ...run, updated_at: "2026-07-10T08:00:00.000Z" }, result, { locale: "en" });

  assert.equal(snapshot.title, "Frozen delivery snapshot");
  assert.match(snapshot.snapshot_id, /^cds_[a-z0-9]+$/);
  assert.equal(snapshot.snapshot_id, sameSnapshot.snapshot_id);
  assert.notEqual(snapshot.snapshot_id, nextSnapshot.snapshot_id);
  assert.equal(snapshot.frozen_at, "2026-07-03T08:00:00.000Z");
  assert.equal(snapshot.window_label, "This week");
  assert.deepEqual(snapshot.metrics, {
    new_candidates: 4,
    contacted: 3,
    replied: 2,
    interview_ready: 1,
    confirmed: 1,
  });
  assert.equal(snapshot.candidate_count, 2);
  assert.deepEqual(snapshot.risks, ["One candidate needs compensation alignment."]);
  assert.deepEqual(snapshot.next_actions, ["Review interview-ready candidate."]);
  assert.doesNotMatch(JSON.stringify(snapshot), /debug|internal|execution_log|role_agent/);
});
