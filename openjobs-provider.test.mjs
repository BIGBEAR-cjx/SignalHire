import test from "node:test";
import assert from "node:assert/strict";
import {
  buildMiraAuthHeaders,
  buildMiraPeopleSearchRequest,
  buildMiraProfilesByIdRequest,
  miraProfilesToShortlistCandidates,
  normalizeMiraProfile,
  searchMiraPeople,
} from "./web/lib/openjobs-provider.mjs";

test("builds Mira bearer auth headers without exposing custom header shape", () => {
  assert.deepEqual(buildMiraAuthHeaders("mira_test"), {
    Authorization: "Bearer mira_test",
    "Content-Type": "application/json",
  });
});

test("builds ID-first OpenJobs people search request", () => {
  const request = buildMiraPeopleSearchRequest({ text: "AI growth lead in US", size: 25 });

  assert.equal(request.url, "https://mira-api.openjobs-ai.com/v1/people-search");
  assert.deepEqual(request.body, { text: "AI growth lead in US", size: 25 });
});

test("builds OpenJobs profile detail request with safe source fields", () => {
  const request = buildMiraProfilesByIdRequest({ profileIds: ["p1", "p2"] });

  assert.equal(request.url, "https://mira-api.openjobs-ai.com/entity/v1/profiles/detail-by-id");
  assert.deepEqual(request.body.profile_ids, ["p1", "p2"]);
  assert.ok(request.body._source.includes("profile_id"));
  assert.ok(request.body._source.includes("full_name"));
  assert.ok(request.body._source.includes("skills"));
});

test("searchMiraPeople fetches IDs first and then profile details", async () => {
  const calls = [];
  const rows = await searchMiraPeople({
    apiKey: "mira_test",
    text: "AI growth lead",
    size: 2,
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      if (url.endsWith("/v1/people-search")) {
        return { ok: true, json: async () => ({ code: 200, data: { profile_ids: ["p1"] } }) };
      }
      return {
        ok: true,
        json: async () => ({
          code: 200,
          data: {
            results: [{
              profile_id: "p1",
              full_name: "Ada Lovelace",
              active_experience_title: "AI Growth Lead",
              active_experience_company: "Example AI",
              linkedin_url: "https://linkedin.com/in/ada",
              skills: ["AI", "Growth"],
            }],
          },
        }),
      };
    },
  });

  assert.equal(calls.length, 2);
  assert.match(calls[0].init.headers.Authorization, /^Bearer /);
  assert.equal(rows[0].provider, "openjobs_mira");
  assert.equal(rows[0].provider_id, "p1");
  assert.equal(rows[0].name, "Ada Lovelace");
});

test("normalizeMiraProfile maps profile detail into provider candidate row", () => {
  const row = normalizeMiraProfile({
    profile_id: "p1",
    full_name: "Grace Hopper",
    active_experience_title: "AI Platform Lead",
    active_experience_company: "Example Labs",
    address: "New York, United States",
    linkedin_url: "https://linkedin.com/in/grace",
    skills: ["Python", "LLM"],
  });

  assert.equal(row.provider, "openjobs_mira");
  assert.equal(row.current_role, "AI Platform Lead");
  assert.equal(row.current_company, "Example Labs");
  assert.equal(row.location, "New York, United States");
  assert.equal(row.linkedin_url, "https://linkedin.com/in/grace");
});

test("normalizeMiraProfile only makes sourced OpenJobs contacts sendable", () => {
  const row = normalizeMiraProfile({
    profile_id: "p1",
    full_name: "Grace Hopper",
    work_email: "grace@example.ai",
    phone_number: "+1 555 0100",
    linkedin_url: "https://linkedin.com/in/grace",
  });

  assert.equal(row.contact_profile.emails[0].value, "grace@example.ai");
  assert.equal(row.contact_profile.emails[0].source, "openjobs_mira");
  assert.equal(row.contact_profile.emails[0].confidence, "medium");
  assert.equal(row.contact_profile.phones[0].source, "openjobs_mira");
  assert.equal(row.contact_profile.contactability_score, 90);
});

test("normalizeMiraProfile keeps current public Mira rows non-sendable", () => {
  const row = normalizeMiraProfile({
    profile_id: "p1",
    full_name: "Grace Hopper",
    linkedin_url: "https://linkedin.com/in/grace",
  });

  assert.deepEqual(row.contact_profile.emails, []);
  assert.deepEqual(row.contact_profile.phones, []);
  assert.equal(row.contact_profile.contactability_score, 15);
});

test("converts Mira profiles into low-evidence shortlist candidates with attribution", () => {
  const candidates = miraProfilesToShortlistCandidates([
    normalizeMiraProfile({ profile_id: "p1", full_name: "Ada Lovelace", skills: ["AI"] }),
  ]);

  assert.equal(candidates[0].provider, "openjobs_mira");
  assert.equal(candidates[0].source_nodes[0].provider, "openjobs_mira");
  assert.equal(candidates[0].source_nodes[0].source_type, "people_api");
  assert.equal(candidates[0].evidence_audit.overall_evidence_quality, "low");
  assert.match(candidates[0].evidence_audit.unverified_claims[0], /OpenJobs AI/);
});
