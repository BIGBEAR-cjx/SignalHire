# Network / Referral Path P2b Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a lightweight project-level Network / Referral Path workflow that imports team or LinkedIn seeds, saves them on the project, and shows client-safe warm intro paths in the role workspace.

**Architecture:** Store sanitized network seeds on `projects.network_seeds` as JSONB, expose a narrow `/api/projects/[id]/network-seeds` PATCH endpoint, and compute `referralPaths` server-side from project shortlist candidates plus seeds. The project page gets one compact panel for CSV/manual import and path display; full social graph, contact enrichment, and private notes remain out of scope.

**Tech Stack:** Next.js App Router, TypeScript/React client page, Insforge raw SQL/SDK project persistence, Node test runner.

---

### Task 1: CSV Seed Import Parser

**Files:**
- Modify: `web/lib/referral-paths.mjs`
- Modify: `web/lib/referral-paths.d.ts`
- Modify: `web/lib/referral-paths.d.mts`
- Test: `referral-paths.test.mjs`

- [ ] **Step 1: Write the failing test**

Add a test named `parses CSV network seeds and drops private fields`:

```js
const seeds = parseNetworkSeedCsv(`name,company,school,project,linkedin_url,email,private_notes
Grace,Example AI,MIT,vLLM,https://linkedin.com/in/grace,grace@example.com,do not share`);
assert.deepEqual(seeds, [{
  label: "Grace",
  relation: "",
  linkedin_url: "linkedin.com/in/grace",
  companies: ["Example AI"],
  schools: ["MIT"],
  projects: ["vLLM"],
}]);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test referral-paths.test.mjs`

Expected: FAIL because `parseNetworkSeedCsv` is not exported.

- [ ] **Step 3: Write minimal implementation**

Add a small quoted-CSV parser and export `parseNetworkSeedCsv(text)`, mapping `name|label|introducer`, `company|companies`, `school|schools`, `project|projects`, and `linkedin_url|linkedin|url` through `normalizeNetworkSeed`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test referral-paths.test.mjs`

Expected: PASS.

### Task 2: Project Persistence and API

**Files:**
- Create: `migrations/20260630142000_project_network_seeds.sql`
- Create: `web/app/api/projects/[id]/network-seeds/route.ts`
- Modify: `web/lib/projects.ts`
- Modify: `web/app/api/projects/[id]/route.ts`
- Test: `api-route-copy.test.mjs`

- [ ] **Step 1: Write the failing tests**

Add static contract tests that assert:
- migration adds `projects.network_seeds jsonb not null default '[]'::jsonb`
- project route imports and returns `referralPaths`
- network-seeds route calls `updateProjectNetworkSeeds`

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test api-route-copy.test.mjs`

Expected: FAIL because route, migration, and API response do not exist.

- [ ] **Step 3: Write minimal implementation**

Add the migration, include `network_seeds` in project selects/types, implement `updateProjectNetworkSeeds`, implement `buildProjectReferralPathView`, return `referralPaths` from project GET, and create a PATCH route that saves sanitized seeds.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test api-route-copy.test.mjs referral-paths.test.mjs`

Expected: PASS.

### Task 3: Project Workspace Panel

**Files:**
- Modify: `web/app/app/projects/[id]/page.tsx`
- Test: `api-route-copy.test.mjs`

- [ ] **Step 1: Write the failing test**

Extend static test to assert project page imports `parseNetworkSeedCsv`, includes `NetworkReferralPathsPanel`, calls `/api/projects/${projectId}/network-seeds`, and renders `referralPaths`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test api-route-copy.test.mjs`

Expected: FAIL because the page panel does not exist.

- [ ] **Step 3: Write minimal implementation**

Add type definitions, import `parseNetworkSeedCsv`, insert `NetworkReferralPathsPanel` after `AutonomousSourcingPanel`, and implement a compact panel with CSV textarea, save button, seed count, and path cards.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test api-route-copy.test.mjs referral-paths.test.mjs`

Expected: PASS.

### Task 4: Verification

**Files:**
- All touched files

- [ ] **Step 1: Run targeted tests**

Run: `node --test referral-paths.test.mjs smart-report.test.mjs api-route-copy.test.mjs candidate-graph.test.mjs`

Expected: PASS.

- [ ] **Step 2: Run web build**

Run: `npm --prefix web run build`

Expected: PASS.

- [ ] **Step 3: Run whitespace check**

Run: `git diff --check`

Expected: PASS.
