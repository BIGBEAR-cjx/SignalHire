import test from "node:test";
import assert from "node:assert/strict";
import {
  buildApolloPeopleEnrichmentRequest,
  buildApolloPeopleSearchRequest,
  buildApolloContactsSearchRequest,
  buildPeopleProviderConfig,
  enrichApolloPerson,
  normalizeApolloPerson,
  normalizePdlPerson,
  providerRowsToSourceLeads,
  searchApolloPeople,
  apolloRowsToShortlistCandidates,
} from "./web/lib/people-providers.mjs";

test("reports providers disabled when API keys are missing", () => {
  const config = buildPeopleProviderConfig({});

  assert.deepEqual(config.providers, [
    { provider: "apollo", enabled: false, reason: "missing APOLLO_API_KEY" },
    { provider: "pdl", enabled: false, reason: "missing PDL_API_KEY" },
  ]);
});

test("normalizes Apollo person rows without leaking provider-specific shape", () => {
  const row = normalizeApolloPerson({
    id: "123",
    name: "Ada Lovelace",
    title: "Head of AI Growth",
    organization: { name: "Example AI" },
    linkedin_url: "https://linkedin.com/in/ada",
    email: "ada@example.ai",
  });

  assert.deepEqual(row, {
    provider: "apollo",
    provider_id: "123",
    name: "Ada Lovelace",
    current_role: "Head of AI Growth",
    current_company: "Example AI",
    location: "",
    linkedin_url: "https://linkedin.com/in/ada",
    contact_profile: {
      emails: [{ value: "ada@example.ai", type: "work", source: "apollo", confidence: "medium" }],
      phones: [],
      linkedin_url: "https://linkedin.com/in/ada",
      contactability_score: 60,
    },
  });
});

test("builds Apollo people search request from role constraints", () => {
  const request = buildApolloPeopleSearchRequest({
    titles: ["AI Growth Lead", "Growth PM"],
    locations: ["San Francisco"],
    organizationDomains: ["openai.com"],
    keywords: "LLM growth lifecycle",
    page: 2,
    perPage: 25,
  });

  assert.equal(request.url, "https://api.apollo.io/api/v1/mixed_people/api_search");
  assert.equal(request.body.page, 2);
  assert.equal(request.body.per_page, 25);
  assert.deepEqual(request.body.person_titles, ["AI Growth Lead", "Growth PM"]);
  assert.deepEqual(request.body.person_locations, ["San Francisco"]);
  assert.deepEqual(request.body.q_organization_domains_list, ["openai.com"]);
  assert.equal(request.body.q_keywords, "LLM growth lifecycle");
});

test("searchApolloPeople calls Apollo with server key and normalizes people", async () => {
  const calls = [];
  const rows = await searchApolloPeople({
    apiKey: "secret",
    input: { titles: ["AI Growth Lead"], keywords: "agent recruiting" },
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return {
        ok: true,
        json: async () => ({
          people: [{
            id: "apollo-1",
            name: "Ada Lovelace",
            title: "AI Growth Lead",
            organization: { name: "Example AI" },
            linkedin_url: "https://linkedin.com/in/ada",
          }],
        }),
      };
    },
  });

  assert.equal(calls[0].url, "https://api.apollo.io/api/v1/mixed_people/api_search");
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[0].init.headers["X-Api-Key"], "secret");
  assert.equal(JSON.parse(calls[0].init.body).person_titles[0], "AI Growth Lead");
  assert.equal(rows[0].provider, "apollo");
  assert.equal(rows[0].provider_id, "apollo-1");
});

test("searchApolloPeople falls back to Apollo contacts search when people API is plan-gated", async () => {
  const calls = [];
  const rows = await searchApolloPeople({
    apiKey: "secret",
    input: { titles: ["AI Growth Lead"], keywords: "agent recruiting", perPage: 2 },
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      if (url.includes("mixed_people/api_search")) {
        return {
          ok: false,
          status: 403,
          json: async () => ({ error: "api/v1/mixed_people/api_search is not accessible with this api_key on a free plan." }),
        };
      }
      return {
        ok: true,
        json: async () => ({
          contacts: [{
            id: "contact-1",
            name: "Grace Hopper",
            title: "AI Growth Lead",
            organization: { name: "Example AI" },
            email: "grace@example.ai",
          }],
        }),
      };
    },
  });

  assert.equal(calls[1].url, "https://api.apollo.io/api/v1/contacts/search");
  assert.match(JSON.parse(calls[1].init.body).q_keywords, /agent recruiting|AI Growth Lead/);
  assert.equal(rows[0].provider_id, "contact-1");
  assert.equal(rows[0].contact_profile.emails[0].source, "apollo");
});

test("builds Apollo contacts search request for workspace fallback", () => {
  const request = buildApolloContactsSearchRequest({
    titles: ["AI Growth Lead"],
    keywords: "agent recruiting",
    page: 3,
    perPage: 10,
  });

  assert.equal(request.url, "https://api.apollo.io/api/v1/contacts/search");
  assert.equal(request.body.page, 3);
  assert.equal(request.body.per_page, 10);
  assert.match(request.body.q_keywords, /AI Growth Lead/);
  assert.match(request.body.q_keywords, /agent recruiting/);
});

test("builds Apollo enrichment request without default reveal flags", () => {
  const request = buildApolloPeopleEnrichmentRequest({
    person: {
      name: "Ada Lovelace",
      current_company: "Example AI",
      linkedin_url: "https://linkedin.com/in/ada",
    },
  });

  assert.equal(request.url, "https://api.apollo.io/api/v1/people/match");
  assert.equal(request.body.name, "Ada Lovelace");
  assert.equal(request.body.organization_name, "Example AI");
  assert.equal(request.body.linkedin_url, "https://linkedin.com/in/ada");
  assert.equal(request.body.reveal_personal_emails, undefined);
  assert.equal(request.body.reveal_phone_number, undefined);
});

test("enrichApolloPerson merges Apollo match data into ContactProfile", async () => {
  const enriched = await enrichApolloPerson({
    apiKey: "secret",
    person: { name: "Ada Lovelace", linkedin_url: "https://linkedin.com/in/ada" },
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({
        person: {
          id: "apollo-1",
          name: "Ada Lovelace",
          title: "AI Growth Lead",
          email: "ada@example.ai",
          organization: { name: "Example AI" },
          linkedin_url: "https://linkedin.com/in/ada",
        },
      }),
    }),
  });

  assert.equal(enriched.provider, "apollo");
  assert.equal(enriched.contact_profile.emails[0].source, "apollo");
  assert.equal(enriched.contact_profile.emails[0].confidence, "medium");
});

test("normalizes PDL person rows into the same provider candidate shape", () => {
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
  assert.equal(row.name, "Grace Hopper");
  assert.equal(row.current_company, "Example Labs");
  assert.equal(row.contact_profile.emails[0].source, "pdl");
});

test("scores contactability from normalized email and phone coverage", () => {
  const row = normalizeApolloPerson({
    name: "Katherine Johnson",
    email: "katherine@example.ai",
    phone_numbers: [{ raw_number: "+1 555 0100" }, "+1 555 0101"],
  });

  assert.deepEqual(row.contact_profile.phones, [
    { value: "+1 555 0100", type: "work", source: "apollo", confidence: "medium" },
    { value: "+1 555 0101", type: "work", source: "apollo", confidence: "medium" },
  ]);
  assert.equal(row.contact_profile.contactability_score, 100);
});

test("converts provider rows to CandidateGraph source leads", () => {
  const leads = providerRowsToSourceLeads([
    normalizeApolloPerson({ name: "Ada", linkedin_url: "https://linkedin.com/in/ada" }),
  ]);

  assert.deepEqual(leads, [
    {
      source_type: "people_api",
      provider: "apollo",
      source_url: "https://linkedin.com/in/ada",
      captured_at: "",
      confidence: "medium",
      extracted_fields: { provider_id: "", name: "Ada", current_company: "" },
    },
  ]);
});

test("converts Apollo provider rows into low-evidence shortlist candidates", () => {
  const candidates = apolloRowsToShortlistCandidates([
    normalizeApolloPerson({
      id: "apollo-1",
      name: "Ada Lovelace",
      title: "AI Growth Lead",
      organization: { name: "Example AI" },
      linkedin_url: "https://linkedin.com/in/ada",
    }),
  ]);

  assert.equal(candidates[0].name, "Ada Lovelace");
  assert.equal(candidates[0].provider, "apollo");
  assert.equal(candidates[0].source_nodes[0].source_type, "people_api");
  assert.equal(candidates[0].source_nodes[0].provider, "apollo");
  assert.equal(candidates[0].evidence_audit.overall_evidence_quality, "low");
  assert.match(candidates[0].evidence_audit.unverified_claims[0], /Apollo/);
});
