import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPeopleProviderConfig,
  normalizePdlPerson,
  providerRowsToSourceLeads,
} from "./web/lib/people-providers.mjs";

test("reports only current people providers", () => {
  const config = buildPeopleProviderConfig({});

  assert.deepEqual(config.providers, [
    { provider: "pdl", enabled: false, reason: "missing PDL_API_KEY" },
  ]);
});

test("normalizes PDL person rows into the provider candidate shape", () => {
  const row = normalizePdlPerson({
    id: "pdl-1",
    full_name: "Grace Hopper",
    job_title: "AI Platform Lead",
    job_company_name: "Example Labs",
    location_name: "New York",
    linkedin_url: "linkedin.com/in/grace",
    work_email: "grace@example.com",
  });

  assert.equal(row.provider, "pdl");
  assert.equal(row.provider_id, "pdl-1");
  assert.equal(row.name, "Grace Hopper");
  assert.equal(row.current_company, "Example Labs");
  assert.equal(row.contact_profile.emails[0].source, "pdl");
  assert.equal(row.contact_profile.contactability_score, 60);
});

test("scores contactability from normalized PDL email and phone coverage", () => {
  const row = normalizePdlPerson({
    full_name: "Katherine Johnson",
    work_email: "katherine@example.ai",
    phone_numbers: [{ raw_number: "+1 555 0100" }, "+1 555 0101"],
  });

  assert.deepEqual(row.contact_profile.phones, [
    { value: "+1 555 0100", type: "work", source: "pdl", confidence: "medium" },
    { value: "+1 555 0101", type: "work", source: "pdl", confidence: "medium" },
  ]);
  assert.equal(row.contact_profile.contactability_score, 100);
});

test("converts provider rows to CandidateGraph source leads", () => {
  const leads = providerRowsToSourceLeads([
    normalizePdlPerson({ full_name: "Ada", linkedin_url: "https://linkedin.com/in/ada" }),
  ]);

  assert.deepEqual(leads, [
    {
      source_type: "people_api",
      provider: "pdl",
      source_url: "https://linkedin.com/in/ada",
      captured_at: "",
      confidence: "medium",
      extracted_fields: { provider_id: "", name: "Ada", current_company: "" },
    },
  ]);
});
