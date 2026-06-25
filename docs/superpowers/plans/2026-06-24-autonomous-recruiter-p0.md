# Autonomous Recruiter P0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build P0 of the autonomous recruiter roadmap: a multi-source CandidateGraph, provider adapter boundary, internal resume/public URL source leads, and a Role Workspace sourcing summary that works even when external API keys are not configured.

**Architecture:** Keep P0 as a view-model and metadata layer, not a database migration. Add pure ESM modules for CandidateGraph and provider normalization, attach the graph to project/run/candidate views, and render the autonomous sourcing state inside the existing project workspace. External APIs are isolated behind adapters so Apollo/PDL keys can be added without changing Role Workspace or candidate merge logic.

**Tech Stack:** Next.js App Router, React, TypeScript declarations, Node ESM modules, InsForge-backed existing project/search/shortlist tables, Node `node:test`.

---

## Scope

P0 includes:

- CandidateGraph view model.
- Multi-source source leads: internal resume/manual candidate, people API normalized rows, LinkedIn URL seed, public web URLs.
- Candidate dedupe by LinkedIn URL, email hash, personal URL, and conservative name+company.
- Source provenance, source mix, merge explanation, evidence quality, and contact coverage.
- Project/Role Workspace panel showing sourcing coverage and candidate pool readiness.
- API key missing fallback: UI still works with internal/project candidates and public web evidence.

P0 excludes:

- Real email unlock.
- Gmail OAuth.
- Automatic sending.
- Calendar scheduling.
- Full Apollo/PDL live API calls from production routes.
- New database tables.

## File Structure

- Create `web/lib/candidate-graph.mjs`
  - Pure CandidateGraph builder, source lead normalization, merge keys, source mix, readiness bucket.
- Create `web/lib/candidate-graph.d.ts`
  - Public types used by React and API routes.
- Create `candidate-graph.test.mjs`
  - Node tests for source provenance, dedupe, evidence gating, contact coverage, and fallback behavior.
- Create `web/lib/people-providers.mjs`
  - Provider result normalizers and provider availability config for Apollo/PDL. P0 does not call live APIs.
- Create `web/lib/people-providers.d.ts`
  - Provider adapter types.
- Create `people-providers.test.mjs`
  - Node tests for Apollo/PDL normalization and disabled-provider behavior.
- Modify `web/lib/projects.ts`
  - Add `buildProjectCandidateGraphView` and include graph summary in project detail API response helpers.
- Modify `web/app/api/projects/[id]/route.ts`
  - Return `candidateGraph` in the project detail payload.
- Modify `web/app/app/projects/[id]/page.tsx`
  - Render Autonomous Sourcing / CandidateGraph panel inside Role Workspace.
- Modify `web/lib/shortlist.ts`
  - Preserve existing ingestion, but enrich stored candidate snapshots with source lead metadata when available.
- Modify `api-route-copy.test.mjs`
  - Add source-level guard that project detail route returns `candidateGraph`.

---

### Task 1: CandidateGraph Contract And Pure Builder

**Files:**
- Create: `web/lib/candidate-graph.mjs`
- Create: `web/lib/candidate-graph.d.ts`
- Create: `candidate-graph.test.mjs`

- [ ] **Step 1: Write failing tests for CandidateGraph source provenance, merge keys, and evidence gating**

Create `candidate-graph.test.mjs`:

```js
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
    provider: "apollo",
    source_url: "https://linkedin.com/in/ada",
    confidence: "high",
    extracted_fields: { name: "Ada Lovelace" },
  });

  assert.deepEqual(lead, {
    source_type: "people_api",
    provider: "apollo",
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
      emails: [{ value: "ada@example.ai", confidence: "high", source: "apollo" }],
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
        source_nodes: [{ source_type: "people_api", provider: "apollo", confidence: "medium" }],
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
node --test candidate-graph.test.mjs
```

Expected: FAIL with an import error for `./web/lib/candidate-graph.mjs`.

- [ ] **Step 3: Add the CandidateGraph implementation**

Create `web/lib/candidate-graph.mjs`:

```js
import { createHash } from "node:crypto";

const SOURCE_TYPES = new Set(["internal_resume", "people_api", "linkedin_seed", "public_web", "manual_upload"]);
const CONFIDENCE = new Set(["high", "medium", "low"]);

function cleanString(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function cleanKey(value) {
  return cleanString(value)
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/+$/, "")
    .replace(/[^a-z0-9\u4e00-\u9fff/._-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 160);
}

function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function sourceTypeOf(value) {
  const clean = cleanString(value);
  return SOURCE_TYPES.has(clean) ? clean : "public_web";
}

function confidenceOf(value) {
  const clean = cleanString(value).toLowerCase();
  return CONFIDENCE.has(clean) ? clean : "low";
}

export function normalizeSourceLead(value = {}) {
  const source = isRecord(value) ? value : {};
  return {
    source_type: sourceTypeOf(source.source_type),
    provider: cleanString(source.provider),
    source_url: cleanString(source.source_url),
    captured_at: cleanString(source.captured_at),
    confidence: confidenceOf(source.confidence),
    extracted_fields: isRecord(source.extracted_fields) ? source.extracted_fields : {},
  };
}

function normalizeLinkedInUrl(value) {
  const key = cleanKey(value);
  if (!key) return "";
  const match = key.match(/linkedin\.com\/in\/[^/?#]+/);
  return match?.[0] ?? "";
}

function candidateEmails(candidate) {
  const profile = isRecord(candidate.contact_profile) ? candidate.contact_profile : {};
  const emails = Array.isArray(profile.emails) ? profile.emails : [];
  return emails.map((item) => cleanString(isRecord(item) ? item.value : item)).filter(Boolean);
}

export function buildCandidateMergeKeys(candidate = {}) {
  const source = isRecord(candidate) ? candidate : {};
  const links = isRecord(source.links) ? source.links : {};
  const keys = [];
  const linkedin = normalizeLinkedInUrl(links.linkedin || source.linkedin_url);
  if (linkedin) keys.push(`linkedin:${linkedin}`);
  for (const email of candidateEmails(source)) keys.push(`email_sha256:${sha256(email.toLowerCase())}`);
  const website = cleanKey(links.website || links.other || source.website_url);
  if (website) keys.push(`url:${website}`);
  const name = cleanKey(source.name);
  const company = cleanKey(source.current_company);
  if (name && company) keys.push(`person:${name}:${company}`);
  return [...new Set(keys)];
}

function sourceLeadFromCandidate(candidate) {
  const source = isRecord(candidate) ? candidate : {};
  const nodes = Array.isArray(source.source_nodes) ? source.source_nodes : [];
  const explicit = nodes.map(normalizeSourceLead);
  const links = isRecord(source.links) ? source.links : {};
  const out = [...explicit];
  if (links.linkedin || source.linkedin_url) {
    out.push(normalizeSourceLead({ source_type: "linkedin_seed", source_url: links.linkedin || source.linkedin_url, confidence: "medium" }));
  }
  const claims = Array.isArray(source.claims) ? source.claims : [];
  for (const claim of claims) {
    const evidence = Array.isArray(claim?.evidence) ? claim.evidence : [];
    for (const item of evidence) {
      if (item?.url) out.push(normalizeSourceLead({ source_type: "public_web", source_url: item.url, confidence: "high", extracted_fields: { source_type: item.source_type ?? "" } }));
    }
  }
  return out;
}

function evidenceQuality(candidate) {
  const audit = isRecord(candidate.evidence_audit) ? candidate.evidence_audit : {};
  const quality = cleanString(audit.overall_evidence_quality).toLowerCase();
  return ["high", "medium", "low"].includes(quality) ? quality : "low";
}

function roleFit(candidate) {
  return {
    score: Math.max(0, Math.min(100, Math.round(Number(candidate.match_score) || 0))),
    must_have_hits: Array.isArray(candidate.strongest_signals) ? candidate.strongest_signals.map(cleanString).filter(Boolean).slice(0, 5) : [],
    gaps: Array.isArray(candidate.uncertainties) ? candidate.uncertainties.map(cleanString).filter(Boolean).slice(0, 5) : [],
    risks: Array.isArray(candidate.evidence_audit?.contradicted_claims) ? candidate.evidence_audit.contradicted_claims.map(cleanString).filter(Boolean).slice(0, 5) : [],
  };
}

function readiness(candidate, sourceNodes) {
  const quality = evidenceQuality(candidate);
  const sourceTypes = new Set(sourceNodes.map((node) => node.source_type));
  const fit = roleFit(candidate);
  if (quality === "high" && sourceTypes.size >= 2 && fit.score >= 75) return "ready_for_outreach";
  if (quality === "low" || sourceTypes.size <= 1) return "needs_verification";
  return "sourced";
}

function mergeCandidate(base, incoming) {
  return {
    ...base,
    canonical_name: base.canonical_name || incoming.canonical_name,
    current_title: base.current_title || incoming.current_title,
    current_company: base.current_company || incoming.current_company,
    locations: [...new Set([...(base.locations ?? []), ...(incoming.locations ?? [])].filter(Boolean))],
    merge_keys: [...new Set([...(base.merge_keys ?? []), ...(incoming.merge_keys ?? [])])],
    source_nodes: [...(base.source_nodes ?? []), ...(incoming.source_nodes ?? [])],
    evidence_summary: incoming.evidence_summary.quality === "high" ? incoming.evidence_summary : base.evidence_summary,
    role_fit: incoming.role_fit.score > base.role_fit.score ? incoming.role_fit : base.role_fit,
    readiness: base.readiness === "ready_for_outreach" ? base.readiness : incoming.readiness,
  };
}

export function buildCandidateGraph({ candidates = [], sourceLeads = [] } = {}) {
  const normalizedSourceLeads = (Array.isArray(sourceLeads) ? sourceLeads : []).map(normalizeSourceLead);
  const byKey = new Map();
  const noKey = [];
  for (const candidate of Array.isArray(candidates) ? candidates : []) {
    const source = isRecord(candidate) ? candidate : {};
    const sourceNodes = [...sourceLeadFromCandidate(source), ...normalizedSourceLeads.filter((lead) => lead.source_url && JSON.stringify(source).includes(lead.source_url))];
    const mergeKeys = buildCandidateMergeKeys(source);
    const item = {
      candidate_id: mergeKeys[0] || `candidate:${noKey.length}`,
      canonical_name: cleanString(source.name),
      current_title: cleanString(source.current_role || source.headline),
      current_company: cleanString(source.current_company),
      locations: cleanString(source.location) ? [cleanString(source.location)] : [],
      source_nodes: sourceNodes,
      merge_keys: mergeKeys,
      evidence_summary: { quality: evidenceQuality(source), claim_count: Array.isArray(source.claims) ? source.claims.length : 0 },
      contact_profile: isRecord(source.contact_profile) ? source.contact_profile : null,
      role_fit: roleFit(source),
      readiness: readiness(source, sourceNodes),
      raw_candidate: source,
    };
    const key = mergeKeys.find((value) => byKey.has(value)) || mergeKeys[0];
    if (key) {
      byKey.set(key, byKey.has(key) ? mergeCandidate(byKey.get(key), item) : item);
    } else {
      noKey.push(item);
    }
  }
  const candidatesOut = [...byKey.values(), ...noKey].map((candidate, index) => ({ ...candidate, candidate_id: candidate.candidate_id || `candidate:${index}` }));
  const mix = new Map();
  for (const node of candidatesOut.flatMap((candidate) => candidate.source_nodes)) {
    mix.set(node.source_type, (mix.get(node.source_type) ?? 0) + 1);
  }
  return {
    summary: {
      candidate_count: candidatesOut.length,
      ready_for_outreach_count: candidatesOut.filter((candidate) => candidate.readiness === "ready_for_outreach").length,
      needs_verification_count: candidatesOut.filter((candidate) => candidate.readiness === "needs_verification").length,
      interview_ready_count: 0,
      source_count: mix.size,
    },
    source_mix: [...mix.entries()].map(([source_type, count]) => ({ source_type, count })),
    candidates: candidatesOut,
  };
}
```

- [ ] **Step 4: Add TypeScript declarations**

Create `web/lib/candidate-graph.d.ts`:

```ts
export type SourceLead = {
  source_type: "internal_resume" | "people_api" | "linkedin_seed" | "public_web" | "manual_upload";
  provider?: string;
  source_url?: string;
  captured_at?: string;
  confidence: "high" | "medium" | "low";
  extracted_fields: Record<string, unknown>;
};

export type CandidateGraphItem = {
  candidate_id: string;
  canonical_name: string;
  current_title: string;
  current_company: string;
  locations: string[];
  source_nodes: SourceLead[];
  merge_keys: string[];
  evidence_summary: { quality: "high" | "medium" | "low"; claim_count: number };
  contact_profile: unknown;
  role_fit: { score: number; must_have_hits: string[]; gaps: string[]; risks: string[] };
  readiness: "sourced" | "needs_verification" | "ready_for_outreach";
  raw_candidate: unknown;
};

export type CandidateGraph = {
  summary: {
    candidate_count: number;
    ready_for_outreach_count: number;
    needs_verification_count: number;
    interview_ready_count: number;
    source_count: number;
  };
  source_mix: Array<{ source_type: string; count: number }>;
  candidates: CandidateGraphItem[];
};

export function normalizeSourceLead(value?: unknown): SourceLead;
export function buildCandidateMergeKeys(candidate?: unknown): string[];
export function buildCandidateGraph(input?: { candidates?: unknown[]; sourceLeads?: unknown[] }): CandidateGraph;
```

- [ ] **Step 5: Run CandidateGraph tests**

Run:

```bash
node --test candidate-graph.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit CandidateGraph contract**

Run:

```bash
git add web/lib/candidate-graph.mjs web/lib/candidate-graph.d.ts candidate-graph.test.mjs
git commit -m "feat: add candidate graph builder"
```

Expected: commit succeeds.

---

### Task 2: People Provider Normalizers And Disabled-Provider Fallback

**Files:**
- Create: `web/lib/people-providers.mjs`
- Create: `web/lib/people-providers.d.ts`
- Create: `people-providers.test.mjs`

- [ ] **Step 1: Write failing provider normalization tests**

Create `people-providers.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPeopleProviderConfig,
  normalizeApolloPerson,
  normalizePdlPerson,
  providerRowsToSourceLeads,
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
```

- [ ] **Step 2: Run provider tests to verify they fail**

Run:

```bash
node --test people-providers.test.mjs
```

Expected: FAIL with an import error for `./web/lib/people-providers.mjs`.

- [ ] **Step 3: Add provider normalizers**

Create `web/lib/people-providers.mjs`:

```js
function cleanString(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function emailRows(value, provider) {
  const emails = Array.isArray(value) ? value : cleanString(value) ? [value] : [];
  return emails.map((email) => ({
    value: cleanString(isRecord(email) ? email.value ?? email.email : email),
    type: "work",
    source: provider,
    confidence: "medium",
  })).filter((email) => email.value);
}

function contactabilityScore(profile) {
  const emails = Array.isArray(profile.emails) ? profile.emails.length : 0;
  const phones = Array.isArray(profile.phones) ? profile.phones.length : 0;
  return Math.min(100, emails * 60 + phones * 25 + (profile.linkedin_url ? 15 : 0));
}

export function buildPeopleProviderConfig(env = process.env) {
  return {
    providers: [
      { provider: "apollo", enabled: Boolean(env.APOLLO_API_KEY), reason: env.APOLLO_API_KEY ? "" : "missing APOLLO_API_KEY" },
      { provider: "pdl", enabled: Boolean(env.PDL_API_KEY), reason: env.PDL_API_KEY ? "" : "missing PDL_API_KEY" },
    ],
  };
}

export function normalizeApolloPerson(value = {}) {
  const row = isRecord(value) ? value : {};
  const organization = isRecord(row.organization) ? row.organization : {};
  const profile = {
    emails: emailRows(row.email || row.emails, "apollo"),
    phones: [],
    linkedin_url: cleanString(row.linkedin_url),
    contactability_score: 0,
  };
  profile.contactability_score = contactabilityScore(profile);
  return {
    provider: "apollo",
    provider_id: cleanString(row.id),
    name: cleanString(row.name),
    current_role: cleanString(row.title),
    current_company: cleanString(organization.name || row.organization_name),
    location: cleanString(row.city || row.location),
    linkedin_url: cleanString(row.linkedin_url),
    contact_profile: profile,
  };
}

export function normalizePdlPerson(value = {}) {
  const row = isRecord(value) ? value : {};
  const profile = {
    emails: emailRows(row.work_email || row.emails, "pdl"),
    phones: [],
    linkedin_url: cleanString(row.linkedin_url),
    contactability_score: 0,
  };
  profile.contactability_score = contactabilityScore(profile);
  return {
    provider: "pdl",
    provider_id: cleanString(row.id),
    name: cleanString(row.full_name || row.name),
    current_role: cleanString(row.job_title || row.title),
    current_company: cleanString(row.job_company_name || row.company),
    location: cleanString(row.location_name || row.location),
    linkedin_url: cleanString(row.linkedin_url),
    contact_profile: profile,
  };
}

export function providerRowsToSourceLeads(rows = []) {
  return (Array.isArray(rows) ? rows : []).map((row) => ({
    source_type: "people_api",
    provider: cleanString(row.provider),
    source_url: cleanString(row.linkedin_url),
    captured_at: "",
    confidence: "medium",
    extracted_fields: {
      provider_id: cleanString(row.provider_id),
      name: cleanString(row.name),
      current_company: cleanString(row.current_company),
    },
  }));
}
```

- [ ] **Step 4: Add TypeScript declarations**

Create `web/lib/people-providers.d.ts`:

```ts
export type PeopleProviderName = "apollo" | "pdl";
export type PeopleProviderStatus = { provider: PeopleProviderName; enabled: boolean; reason: string };
export type ProviderCandidateRow = {
  provider: PeopleProviderName;
  provider_id: string;
  name: string;
  current_role: string;
  current_company: string;
  location: string;
  linkedin_url: string;
  contact_profile: {
    emails: Array<{ value: string; type: "work"; source: PeopleProviderName; confidence: "medium" }>;
    phones: unknown[];
    linkedin_url: string;
    contactability_score: number;
  };
};

export function buildPeopleProviderConfig(env?: Record<string, string | undefined>): { providers: PeopleProviderStatus[] };
export function normalizeApolloPerson(value?: unknown): ProviderCandidateRow;
export function normalizePdlPerson(value?: unknown): ProviderCandidateRow;
export function providerRowsToSourceLeads(rows?: ProviderCandidateRow[]): Array<{
  source_type: "people_api";
  provider: string;
  source_url: string;
  captured_at: string;
  confidence: "medium";
  extracted_fields: Record<string, unknown>;
}>;
```

- [ ] **Step 5: Run provider tests**

Run:

```bash
node --test people-providers.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit provider adapter boundary**

Run:

```bash
git add web/lib/people-providers.mjs web/lib/people-providers.d.ts people-providers.test.mjs
git commit -m "feat: add people provider normalizers"
```

Expected: commit succeeds.

---

### Task 3: Attach CandidateGraph To Project Detail Data

**Files:**
- Modify: `web/lib/projects.ts`
- Modify: `web/app/api/projects/[id]/route.ts`
- Modify: `api-route-copy.test.mjs`

- [ ] **Step 1: Add route/source-level tests for CandidateGraph payload**

Append to `api-route-copy.test.mjs`:

```js
test("project detail API returns autonomous sourcing candidate graph", () => {
  const route = readFileSync("web/app/api/projects/[id]/route.ts", "utf8");
  const projects = readFileSync("web/lib/projects.ts", "utf8");

  assert.match(projects, /buildProjectCandidateGraphView/);
  assert.match(projects, /buildCandidateGraph/);
  assert.match(projects, /candidateGraph/);
  assert.match(route, /candidateGraph: await buildProjectCandidateGraphView/);
});
```

- [ ] **Step 2: Run route-copy test to verify it fails**

Run:

```bash
node --test api-route-copy.test.mjs
```

Expected: FAIL on `buildProjectCandidateGraphView` not found.

- [ ] **Step 3: Add project-level CandidateGraph builder**

Modify `web/lib/projects.ts`:

```ts
import { buildCandidateGraph } from "./candidate-graph.mjs";
import { buildPeopleProviderConfig, providerRowsToSourceLeads } from "./people-providers.mjs";
```

Add near project helper interfaces:

```ts
export interface ProjectCandidateGraphView {
  provider_status: Array<{ provider: "apollo" | "pdl"; enabled: boolean; reason: string }>;
  summary: {
    candidate_count: number;
    ready_for_outreach_count: number;
    needs_verification_count: number;
    interview_ready_count: number;
    source_count: number;
  };
  source_mix: Array<{ source_type: string; count: number }>;
  candidates: Array<{
    candidate_id: string;
    canonical_name: string;
    current_title: string;
    current_company: string;
    readiness: "sourced" | "needs_verification" | "ready_for_outreach";
    source_count: number;
    source_types: string[];
    evidence_quality: string;
    contactability_score: number;
    merge_keys: string[];
  }>;
}
```

Add after `projectRuns`:

```ts
export async function buildProjectCandidateGraphView(userId: string, projectId: string): Promise<ProjectCandidateGraphView> {
  const items = await import("./shortlist.ts").then((module) => module.listItems(userId, projectId));
  const candidates = items.map((item) => item.candidate);
  const providerRows = candidates
    .map((candidate) => {
      if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return null;
      const source = candidate as Record<string, unknown>;
      return source.provider ? source : null;
    })
    .filter(Boolean) as Array<Record<string, unknown>>;
  const graph = buildCandidateGraph({
    candidates,
    sourceLeads: providerRowsToSourceLeads(providerRows as never),
  });
  return {
    provider_status: buildPeopleProviderConfig().providers,
    summary: graph.summary,
    source_mix: graph.source_mix,
    candidates: graph.candidates.map((candidate) => ({
      candidate_id: candidate.candidate_id,
      canonical_name: candidate.canonical_name,
      current_title: candidate.current_title,
      current_company: candidate.current_company,
      readiness: candidate.readiness,
      source_count: candidate.source_nodes.length,
      source_types: [...new Set(candidate.source_nodes.map((node) => node.source_type))],
      evidence_quality: candidate.evidence_summary.quality,
      contactability_score: Number((candidate.contact_profile as { contactability_score?: number } | null)?.contactability_score ?? 0),
      merge_keys: candidate.merge_keys,
    })),
  };
}
```

- [ ] **Step 4: Return `candidateGraph` from project detail API**

Modify `web/app/api/projects/[id]/route.ts`.

Ensure imports include:

```ts
import { buildProjectCandidateGraphView } from "@/lib/projects";
```

In the GET response object, add:

```ts
candidateGraph: await buildProjectCandidateGraphView(user.id, id),
```

- [ ] **Step 5: Run tests**

Run:

```bash
node --test candidate-graph.test.mjs people-providers.test.mjs api-route-copy.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit project data integration**

Run:

```bash
git add web/lib/projects.ts web/app/api/projects/[id]/route.ts api-route-copy.test.mjs
git commit -m "feat: expose candidate graph in project detail"
```

Expected: commit succeeds.

---

### Task 4: Render Autonomous Sourcing Panel In Role Workspace

**Files:**
- Modify: `web/app/app/projects/[id]/page.tsx`
- Modify: `api-route-copy.test.mjs`

- [ ] **Step 1: Add source-level UI guard test**

Append to `api-route-copy.test.mjs`:

```js
test("role workspace renders autonomous sourcing graph panel", () => {
  const page = readFileSync("web/app/app/projects/[id]/page.tsx", "utf8");

  assert.match(page, /AutonomousSourcingPanel/);
  assert.match(page, /candidateGraph/);
  assert.match(page, /ready_for_outreach_count/);
  assert.match(page, /needs_verification_count/);
  assert.match(page, /source_mix/);
});
```

- [ ] **Step 2: Run route-copy test to verify it fails**

Run:

```bash
node --test api-route-copy.test.mjs
```

Expected: FAIL on `AutonomousSourcingPanel` not found.

- [ ] **Step 3: Add CandidateGraph types to project page**

Modify `web/app/app/projects/[id]/page.tsx`.

Add after `type OutreachQueueView`:

```ts
type CandidateGraphView = {
  provider_status: Array<{ provider: "apollo" | "pdl"; enabled: boolean; reason: string }>;
  summary: {
    candidate_count: number;
    ready_for_outreach_count: number;
    needs_verification_count: number;
    interview_ready_count: number;
    source_count: number;
  };
  source_mix: Array<{ source_type: string; count: number }>;
  candidates: Array<{
    candidate_id: string;
    canonical_name: string;
    current_title: string;
    current_company: string;
    readiness: "sourced" | "needs_verification" | "ready_for_outreach";
    source_count: number;
    source_types: string[];
    evidence_quality: string;
    contactability_score: number;
    merge_keys: string[];
  }>;
};
```

Add to `ProjectDetail`:

```ts
candidateGraph?: CandidateGraphView;
```

- [ ] **Step 4: Add copy and panel component**

Add below `monitorCopy`:

```tsx
function autonomousCopy(locale: "zh" | "en") {
  return locale === "en" ? {
    title: "Autonomous sourcing",
    desc: "Multi-source candidate graph for this role. External people APIs stay optional until keys are configured.",
    sourced: "Sourced",
    ready: "Ready for outreach",
    needsVerification: "Needs verification",
    sources: "Sources",
    providers: "Providers",
    disabled: "Disabled",
    enabled: "Enabled",
    sourceMix: "Source mix",
    candidateReadiness: "Candidate readiness",
    empty: "No candidates in this role yet.",
  } : {
    title: "Autonomous sourcing",
    desc: "这个岗位的多来源候选人图谱。外部 people API 未配置时，仍会使用候选池和公开证据降级展示。",
    sourced: "已发现",
    ready: "可进入外联",
    needsVerification: "需补证据",
    sources: "来源数",
    providers: "数据源",
    disabled: "未启用",
    enabled: "已启用",
    sourceMix: "来源构成",
    candidateReadiness: "候选人推进状态",
    empty: "这个岗位还没有候选人。",
  };
}

function AutonomousSourcingPanel({ graph, locale }: { graph?: CandidateGraphView; locale: "zh" | "en" }) {
  const c = autonomousCopy(locale);
  if (!graph) return null;
  return (
    <Surface className="space-y-4 p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <FiSearch className="h-4 w-4 text-[var(--sh-blue)]" aria-hidden="true" />
            <h2 className="text-base font-semibold text-[var(--sh-ink)]">{c.title}</h2>
          </div>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--sh-muted)]">{c.desc}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {graph.provider_status.map((provider) => (
            <StatusBadge
              key={provider.provider}
              label={`${provider.provider.toUpperCase()} · ${provider.enabled ? c.enabled : c.disabled}`}
              dotClassName={provider.enabled ? "bg-emerald-500" : "bg-gray-400"}
              className={provider.enabled ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-gray-100 text-gray-600 ring-gray-200"}
            />
          ))}
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-black/10 bg-white/80 p-4">
          <p className="text-xs text-[var(--sh-muted)]">{c.sourced}</p>
          <p className="mt-1 text-2xl font-semibold text-[var(--sh-ink)]">{graph.summary.candidate_count}</p>
        </div>
        <div className="rounded-2xl border border-black/10 bg-white/80 p-4">
          <p className="text-xs text-[var(--sh-muted)]">{c.ready}</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-700">{graph.summary.ready_for_outreach_count}</p>
        </div>
        <div className="rounded-2xl border border-black/10 bg-white/80 p-4">
          <p className="text-xs text-[var(--sh-muted)]">{c.needsVerification}</p>
          <p className="mt-1 text-2xl font-semibold text-amber-700">{graph.summary.needs_verification_count}</p>
        </div>
        <div className="rounded-2xl border border-black/10 bg-white/80 p-4">
          <p className="text-xs text-[var(--sh-muted)]">{c.sources}</p>
          <p className="mt-1 text-2xl font-semibold text-[var(--sh-ink)]">{graph.summary.source_count}</p>
        </div>
      </div>
      <div className="grid gap-3 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="rounded-2xl border border-black/10 bg-white/80 p-4">
          <p className="text-sm font-semibold text-[var(--sh-ink)]">{c.sourceMix}</p>
          <div className="mt-3 space-y-2">
            {graph.source_mix.length === 0 ? (
              <p className="text-sm text-[var(--sh-muted)]">{c.empty}</p>
            ) : graph.source_mix.map((source) => (
              <div key={source.source_type} className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2 text-xs ring-1 ring-black/5">
                <span className="font-medium text-gray-800">{source.source_type.replace(/_/g, " ")}</span>
                <span className="text-gray-500">{source.count}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-black/10 bg-white/80 p-4">
          <p className="text-sm font-semibold text-[var(--sh-ink)]">{c.candidateReadiness}</p>
          <div className="mt-3 grid gap-2">
            {graph.candidates.length === 0 ? (
              <p className="text-sm text-[var(--sh-muted)]">{c.empty}</p>
            ) : graph.candidates.slice(0, 6).map((candidate) => (
              <div key={candidate.candidate_id} className="grid gap-2 rounded-xl bg-gray-50 px-3 py-2 text-xs ring-1 ring-black/5 md:grid-cols-[minmax(0,1fr)_120px_110px]">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-gray-900">{candidate.canonical_name || "Unnamed candidate"}</p>
                  <p className="truncate text-gray-500">{[candidate.current_title, candidate.current_company].filter(Boolean).join(" · ") || "-"}</p>
                </div>
                <span className="self-center rounded-full bg-white px-2 py-1 text-center font-medium text-gray-700 ring-1 ring-black/10">{candidate.readiness.replace(/_/g, " ")}</span>
                <span className="self-center text-right text-gray-500">{candidate.source_count} sources</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Surface>
  );
}
```

- [ ] **Step 5: Render panel in the project page**

In the main project detail JSX, place this panel after the project summary/KPI area and before `TalentMonitorPanel`:

```tsx
<AutonomousSourcingPanel graph={detail.candidateGraph} locale={locale} />
```

- [ ] **Step 6: Run UI source test and build**

Run:

```bash
node --test api-route-copy.test.mjs
npm --prefix web run build
```

Expected: tests PASS and build succeeds.

- [ ] **Step 7: Commit Role Workspace panel**

Run:

```bash
git add web/app/app/projects/[id]/page.tsx api-route-copy.test.mjs
git commit -m "feat: show autonomous sourcing in role workspace"
```

Expected: commit succeeds.

---

### Task 5: Preserve Candidate Source Metadata During Project Run Ingestion

**Files:**
- Modify: `web/lib/shortlist.ts`
- Modify: `api-route-copy.test.mjs`

- [ ] **Step 1: Add source-level guard for source metadata enrichment**

Append to `api-route-copy.test.mjs`:

```js
test("project run ingestion preserves candidate source nodes", () => {
  const shortlist = readFileSync("web/lib/shortlist.ts", "utf8");

  assert.match(shortlist, /withCandidateSourceNodes/);
  assert.match(shortlist, /source_nodes/);
  assert.match(shortlist, /source_type: "public_web"/);
  assert.match(shortlist, /source_type: "linkedin_seed"/);
});
```

- [ ] **Step 2: Run guard test to verify it fails**

Run:

```bash
node --test api-route-copy.test.mjs
```

Expected: FAIL on `withCandidateSourceNodes` not found.

- [ ] **Step 3: Add source node preservation helper**

Modify `web/lib/shortlist.ts`.

Add before `candidateStatusFromEvidence`:

```ts
function withCandidateSourceNodes(candidate: unknown): unknown {
  if (!isPlainObject(candidate)) return candidate;
  const links = isPlainObject(candidate.links) ? candidate.links : {};
  const sourceNodes: Array<Record<string, unknown>> = Array.isArray(candidate.source_nodes)
    ? [...candidate.source_nodes as Array<Record<string, unknown>>]
    : [];
  if (typeof links.linkedin === "string" && links.linkedin.trim()) {
    sourceNodes.push({ source_type: "linkedin_seed", source_url: links.linkedin.trim(), confidence: "medium" });
  }
  const claims = Array.isArray(candidate.claims) ? candidate.claims : [];
  for (const claim of claims) {
    if (!isPlainObject(claim) || !Array.isArray(claim.evidence)) continue;
    for (const evidence of claim.evidence) {
      if (!isPlainObject(evidence) || typeof evidence.url !== "string" || !evidence.url.trim()) continue;
      sourceNodes.push({
        source_type: "public_web",
        source_url: evidence.url.trim(),
        confidence: claim.verdict === "verified" ? "high" : "low",
        extracted_fields: { source_type: evidence.source_type ?? "" },
      });
    }
  }
  return { ...candidate, source_nodes: sourceNodes };
}
```

Update `ingestProjectRunCandidates`:

```ts
const candidate = withCandidateSourceNodes(candidates[index]);
const dedup_key = makeProjectCandidateDedupKey(input.userId, input.projectId, candidate, index);
const id = await addItem({
  userId: input.userId,
  sourceRunId: input.sourceRunId,
  candidateIndex: index,
  candidate,
  projectId: input.projectId,
  status: candidateStatusFromEvidence(candidate),
  dedupKey: dedup_key,
});
```

- [ ] **Step 4: Run guard and existing shortlist-related tests**

Run:

```bash
node --test api-route-copy.test.mjs search-tasks.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit source metadata preservation**

Run:

```bash
git add web/lib/shortlist.ts api-route-copy.test.mjs
git commit -m "feat: preserve candidate source nodes"
```

Expected: commit succeeds.

---

### Task 6: Final Verification And Browser QA

**Files:**
- No planned source edits.

- [ ] **Step 1: Run focused Node tests**

Run:

```bash
node --test candidate-graph.test.mjs people-providers.test.mjs api-route-copy.test.mjs search-tasks.test.mjs talent-profile.test.mjs
```

Expected: PASS.

- [ ] **Step 2: Run frontend build**

Run:

```bash
npm --prefix web run build
```

Expected: build succeeds.

- [ ] **Step 3: Start the app for browser verification**

Run:

```bash
npm --prefix web run dev
```

Expected: local dev server starts and prints a localhost URL.

- [ ] **Step 4: Verify Role Workspace manually in browser**

Use a test account and open a role page under `/app/projects/<id>`.

Expected:

- The page renders without horizontal overflow on desktop and mobile.
- The `Autonomous sourcing` panel appears.
- Provider chips show Apollo/PDL disabled when keys are missing.
- Candidate count matches the project candidate pool.
- Low evidence candidates are labeled as `needs verification`.
- The existing Talent Monitor, candidate list, evidence matrix, and outreach queue still render.

- [ ] **Step 5: Stop the dev server**

Stop the dev server process cleanly with `Ctrl-C`.

Expected: no lingering process is needed for this plan.

---

## Self-Review

Spec coverage:

- P0 CandidateGraph: covered by Tasks 1 and 3.
- Internal/project candidate fallback: covered by Tasks 3 and 6.
- People API adapter boundary: covered by Task 2.
- LinkedIn URL seed and public web source provenance: covered by Tasks 1 and 5.
- Source mix, dedupe, evidence gating, contactability: covered by Tasks 1, 2, and 4.
- Role Workspace visibility: covered by Task 4.
- No new database table: all tasks use existing project, run, and shortlist data.

Known implementation constraints:

- P0 intentionally does not perform live Apollo/PDL network calls. That keeps the first implementation testable without paid API keys and avoids coupling UI to vendor rate limits.
- If `web/app/api/projects/[id]/route.ts` already returns candidates, keep that shape and add `candidateGraph` as an additive field.
- If TypeScript complains about importing `.ts` from `projects.ts` dynamic import in Task 3, replace the dynamic import with a normal top-level import from `./shortlist` and update the source-level test accordingly.

