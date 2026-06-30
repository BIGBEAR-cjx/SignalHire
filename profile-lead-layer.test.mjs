import test from "node:test";
import assert from "node:assert/strict";
import { buildProfileLeadLayerView } from "./web/lib/profile-lead-layer.mjs";

test("builds Profile Lead Layer copy and evidence verification counts", () => {
  const view = buildProfileLeadLayerView({
    locale: "en",
    env: { MIRA_KEY: "mira_test" },
    leadPreview: {
      items: [
        { source_type: "people_api", can_outreach: false },
        { source_type: "github", can_outreach: false },
      ],
    },
    candidateGraph: {
      source_mix: [{ source_type: "people_api", count: 3 }],
      candidates: [
        { evidence_quality: "low", readiness: "needs_verification", source_types: ["people_api"] },
        { evidence_quality: "high", readiness: "ready_for_outreach", source_types: ["github", "public_web"] },
      ],
    },
  });

  assert.equal(view.provider, "openjobs_mira");
  assert.equal(view.enabled, true);
  assert.equal(view.lead_count, 4);
  assert.equal(view.verified_candidate_count, 1);
  assert.equal(view.needs_evidence_count, 3);
  assert.equal(view.copy.title, "Profile Lead Layer");
  assert.match(view.copy.explanation, /profile leads/i);
  assert.match(view.copy.next_step, /evidence verification/i);
  assert.doesNotMatch(`${view.copy.title} ${view.copy.explanation}`, /database search/i);
});

test("localizes Profile Lead Layer guardrail copy", () => {
  const view = buildProfileLeadLayerView({
    locale: "zh",
    env: {},
    leadPreview: { items: [{ source_type: "people_api" }] },
  });

  assert.equal(view.enabled, false);
  assert.match(view.copy.title, /资料线索层/);
  assert.match(view.copy.next_step, /证据核验/);
});
