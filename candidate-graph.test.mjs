import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCandidateGraph,
  buildCandidateMergeKeys,
  normalizeSourceLead,
} from "./web/lib/candidate-graph.mjs";

test("normalizes source leads with source provenance", () => {
  const lead = normalizeSourceLead({
    source_type: "people_api",
    provider: "pdl",
    source_url: "https://linkedin.com/in/ada",
    confidence: "high",
    extracted_fields: { name: "Ada Lovelace" },
  });

  assert.deepEqual(lead, {
    source_type: "people_api",
    provider: "pdl",
    source_url: "https://linkedin.com/in/ada",
    captured_at: "",
    confidence: "high",
    extracted_fields: { name: "Ada Lovelace" },
  });
});

test("builds conservative merge keys from LinkedIn URL, email hash, personal URL, and name company", () => {
  const keys = buildCandidateMergeKeys({
    name: "Ada Lovelace",
    current_company: "Example AI",
    links: {
      linkedin: "https://www.linkedin.com/in/ada-lovelace/",
      website: "https://ada.example.com",
    },
    contact_profile: {
      emails: [{ value: "ada@example.ai", confidence: "high", source: "pdl" }],
    },
  });

  assert.ok(keys.includes("linkedin:linkedin.com/in/ada-lovelace"));
  assert.ok(keys.some((key) => key.startsWith("email_sha256:")));
  assert.ok(keys.includes("url:ada.example.com"));
  assert.ok(keys.includes("person:ada-lovelace:example-ai"));
});

test("dedupes candidates and preserves all source nodes", () => {
  const graph = buildCandidateGraph({
    candidates: [
      {
        name: "Ada Lovelace",
        current_role: "Growth Lead",
        current_company: "Example AI",
        match_score: 92,
        links: { linkedin: "https://linkedin.com/in/ada" },
        claims: [
          { claim: "Led AI growth", verdict: "verified", evidence: [{ url: "https://example.ai/ada", source_type: "company" }] },
        ],
        evidence_audit: { overall_evidence_quality: "high", unverified_claims: [], contradicted_claims: [] },
      },
      {
        name: "Ada Lovelace",
        current_role: "Growth",
        current_company: "Example AI",
        links: { linkedin: "https://www.linkedin.com/in/ada/" },
        source_nodes: [{ source_type: "people_api", provider: "pdl", confidence: "medium" }],
      },
    ],
    sourceLeads: [
      { source_type: "public_web", source_url: "https://example.ai/ada", confidence: "high" },
      { source_type: "linkedin_seed", source_url: "https://linkedin.com/in/ada", confidence: "medium" },
    ],
  });

  assert.equal(graph.candidates.length, 1);
  assert.equal(graph.candidates[0].canonical_name, "Ada Lovelace");
  assert.equal(graph.candidates[0].source_nodes.length, 4);
  assert.deepEqual(graph.source_mix.map((item) => [item.source_type, item.count]), [
    ["people_api", 1],
    ["public_web", 1],
    ["linkedin_seed", 1],
  ]);
});

test("does not mark single-source or low-evidence candidates as interview ready", () => {
  const graph = buildCandidateGraph({
    candidates: [
      {
        name: "Grace Hopper",
        current_company: "Unknown",
        match_score: 95,
        links: { linkedin: "https://linkedin.com/in/grace" },
        evidence_audit: { overall_evidence_quality: "low", unverified_claims: ["Current role"], contradicted_claims: [] },
        claims: [{ claim: "Works on AI", verdict: "unverified", evidence: [] }],
      },
    ],
    sourceLeads: [{ source_type: "linkedin_seed", source_url: "https://linkedin.com/in/grace", confidence: "medium" }],
  });

  assert.equal(graph.candidates[0].readiness, "needs_verification");
  assert.equal(graph.summary.interview_ready_count, 0);
  assert.equal(graph.summary.needs_verification_count, 1);
});

test("summarizes contact coverage without requiring unlocked external providers", () => {
  const graph = buildCandidateGraph({
    candidates: [
      {
        name: "Ada Lovelace",
        current_company: "Example AI",
        match_score: 88,
        links: { linkedin: "https://linkedin.com/in/ada" },
        contact_profile: { emails: [{ value: "ada@example.ai" }], phones: [] },
        source_nodes: [{ source_type: "internal_resume", confidence: "high" }],
        evidence_audit: { overall_evidence_quality: "high", unverified_claims: [], contradicted_claims: [] },
      },
      {
        name: "Grace Hopper",
        current_company: "Example Labs",
        match_score: 80,
        links: { linkedin: "https://linkedin.com/in/grace" },
        source_nodes: [{ source_type: "linkedin_seed", confidence: "medium" }],
        evidence_audit: { overall_evidence_quality: "medium", unverified_claims: [], contradicted_claims: [] },
      },
    ],
  });

  assert.equal(graph.summary.contactable_count, 1);
  assert.equal(graph.summary.contact_coverage_percent, 50);
});

test("keeps interview-ready count at zero before inbox or scheduling signals exist", () => {
  const graph = buildCandidateGraph({
    candidates: [
      {
        name: "Ada Lovelace",
        current_company: "Example AI",
        match_score: 92,
        links: { linkedin: "https://linkedin.com/in/ada" },
        source_nodes: [{ source_type: "internal_resume", confidence: "high" }],
        claims: [
          { claim: "Led AI growth", verdict: "verified", evidence: [{ url: "https://example.ai/ada", source_type: "company" }] },
        ],
        evidence_audit: { overall_evidence_quality: "high", unverified_claims: [], contradicted_claims: [] },
      },
    ],
  });

  assert.equal(graph.summary.ready_for_outreach_count, 1);
  assert.equal(graph.summary.interview_ready_count, 0);
});
