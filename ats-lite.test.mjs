import test from "node:test";
import assert from "node:assert/strict";
import {
  buildAtsCandidateExportPayload,
  buildAtsDedupeKeys,
  buildAtsJobImportView,
  buildAtsLiteProviderStatus,
  buildAtsProjectDraft,
  mockGreenhouseJob,
} from "./web/lib/ats-lite.mjs";

test("reports Greenhouse disabled when server key is missing", () => {
  const status = buildAtsLiteProviderStatus({});
  assert.equal(status.provider, "greenhouse");
  assert.equal(status.enabled, false);
  assert.match(status.reason, /GREENHOUSE_API_KEY/);
});

test("normalizes a Greenhouse job import into a SignalHire project draft", () => {
  const job = buildAtsJobImportView(mockGreenhouseJob("gh-ml-platform"));
  const draft = buildAtsProjectDraft(job);

  assert.equal(job.provider, "greenhouse");
  assert.equal(job.external_job_id, "gh-ml-platform");
  assert.match(job.title, /ML Platform/);
  assert.match(draft.name, /ML Platform/);
  assert.match(draft.brief, /Department:/);
  assert.match(draft.brief, /Location:/);
  assert.match(draft.brief, /Job description:/);
});

test("builds ATS candidate export payload with evidence and dedupe keys", () => {
  const result = buildAtsCandidateExportPayload({
    projectId: "project-1",
    candidateId: "item-1",
    status: "shortlisted",
    reportBaseUrl: "https://signalhire.test",
    candidate: {
      name: "Ada Lovelace",
      current_company: "Analytical Engines",
      links: { linkedin: "https://www.linkedin.com/in/ada/" },
      contact_profile: {
        emails: [{ value: "ada@example.com", confidence: "high", deliverability_status: "valid" }],
      },
      claims: [{ text: "Built scheduling infrastructure", verdict: "verified" }],
      source_nodes: [
        { source_type: "linkedin_seed" },
        { source_type: "public_web" },
        { source_type: "public_web" },
      ],
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.payload.provider, "greenhouse");
  assert.equal(result.payload.name, "Ada Lovelace");
  assert.equal(result.payload.email, "ada@example.com");
  assert.equal(result.payload.linkedin_url, "linkedin.com/in/ada");
  assert.match(result.payload.evidence_summary, /Built scheduling infrastructure/);
  assert.match(result.payload.source_mix_summary, /public_web x2/);
  assert.match(result.payload.report_url, /\/app\/projects\/project-1\?candidate=item-1/);
  assert.equal(result.dedupe_keys.linkedin_url, "linkedin.com/in/ada");
  assert.match(result.dedupe_keys.email_hash, /^[a-f0-9]{64}$/);
});

test("refuses to export unreviewed or low-evidence candidates", () => {
  const result = buildAtsCandidateExportPayload({
    projectId: "project-1",
    candidateId: "item-2",
    status: "needs_evidence",
    candidate: { name: "Low Signal" },
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, "candidate_not_reviewed");
});

test("dedupe keys use ATS id, email hash, and normalized LinkedIn URL", () => {
  const keys = buildAtsDedupeKeys({
    atsCandidateId: "gh-candidate-1",
    candidate: {
      links: { linkedin: "https://linkedin.com/in/ada?trk=profile" },
      contact_profile: { emails: [{ value: "Ada@Example.com", confidence: "high" }] },
    },
  });

  assert.equal(keys.ats_candidate_id, "gh-candidate-1");
  assert.equal(keys.linkedin_url, "linkedin.com/in/ada");
  assert.match(keys.email_hash, /^[a-f0-9]{64}$/);
});
