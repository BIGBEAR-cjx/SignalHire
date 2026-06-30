import test from "node:test";
import assert from "node:assert/strict";
import { buildSmartReportView } from "./web/lib/smart-report.mjs";

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
