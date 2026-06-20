import test from "node:test";
import assert from "node:assert/strict";
import {
  buildRelatedTalentView,
  buildTalentIntelligenceReport,
} from "./web/lib/talent-intelligence.mjs";

const candidate = {
  name: "Ada Lovelace",
  current_role: "Staff Engineer",
  current_company: "Example AI",
  match_score: 92,
  ai_directions: ["Applied AI / Agents"],
  strongest_signals: ["Merged agent runtime PRs", "Published an agent evaluation paper"],
  outreach_angle: "Lead with her open-source agent runtime work.",
  evidence_audit: {
    overall_evidence_quality: "high",
    verified_claims: ["Merged agent runtime PRs"],
    unverified_claims: ["Led every production launch"],
    contradicted_claims: [],
    identity_risks: [],
  },
  claims: [
    { claim: "Merged agent runtime PRs", verdict: "verified", evidence: [{ url: "https://github.com/example/agent", source_type: "code" }] },
    { claim: "Published an agent evaluation paper", verdict: "verified", evidence: [{ url: "https://arxiv.org/abs/1234.5678", source_type: "paper" }] },
    { claim: "Spoke about agent UX", verdict: "verified", evidence: [{ url: "https://youtube.com/watch?v=abc", source_type: "talk" }] },
    { claim: "Works at Example AI", verdict: "verified", evidence: [{ url: "https://example.ai/team/ada", source_type: "company" }] },
    { claim: "Led every production launch", verdict: "unverified", evidence: [] },
  ],
};

test("builds a four-section evidence-first talent intelligence report", () => {
  const report = buildTalentIntelligenceReport({ candidate, locale: "en" });

  assert.equal(report.name, "Ada Lovelace");
  assert.equal(report.headline, "Staff Engineer / Example AI");
  assert.equal(report.match_score, 92);
  assert.equal(report.evidence_quality, "high");
  assert.deepEqual(report.sections.map((section) => section.key), ["technical", "research", "influence", "career"]);
  assert.equal(report.audit.verified_count, 4);
  assert.equal(report.audit.unverified_count, 1);
  assert.equal(report.audit.contradicted_count, 0);
  assert.match(report.next_actions[0], /outreach/i);
  assert.match(report.next_actions[1], /evidence gap/i);
});

test("builds related talent with explicit relation reasons and search brief", () => {
  const related = buildRelatedTalentView({
    candidate,
    pool: [
      {
        name: "Grace Hopper",
        current_role: "Engineer",
        current_company: "Agent Labs",
        ai_directions: ["Applied AI / Agents"],
        claims: [{ claim: "Contributed to the same agent runtime", verdict: "verified", evidence: [{ url: "https://github.com/example/agent", source_type: "code" }] }],
      },
      {
        name: "No Evidence",
        ai_directions: ["Applied AI / Agents"],
        claims: [{ claim: "Seems similar", verdict: "unverified", evidence: [] }],
      },
    ],
    locale: "en",
  });

  assert.equal(related.items.length, 1);
  assert.equal(related.items[0].name, "Grace Hopper");
  assert.match(related.items[0].relation_reason, /same code source|same AI direction/i);
  assert.match(related.generated_search_brief, /Ada Lovelace/);
  assert.match(related.generated_search_brief, /Applied AI \/ Agents/);
});
