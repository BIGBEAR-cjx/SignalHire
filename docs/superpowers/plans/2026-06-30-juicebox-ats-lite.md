# ATS-lite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Greenhouse-first ATS-lite loop: provider status, mock job import into a SignalHire project, candidate export preview payloads, and dedupe keys.

**Architecture:** Keep ATS logic in `web/lib/ats-lite.mjs` with pure functions for provider status, Greenhouse mock job normalization, project draft construction, export payload building, and dedupe keys. Add narrow server routes for status, job import, and candidate export preview; UI only triggers those routes and never handles provider tokens.

**Tech Stack:** Next.js App Router, React client pages, Insforge project/shortlist persistence, Node test runner.

---

### Task 1: ATS-lite Core

**Files:**
- Create: `web/lib/ats-lite.mjs`
- Create: `web/lib/ats-lite.d.ts`
- Create: `web/lib/ats-lite.d.mts`
- Test: `ats-lite.test.mjs`

- [ ] **Step 1: Write failing tests**

Cover provider disabled status, Greenhouse mock job import view, project draft construction, candidate export guardrails, export payload fields, and dedupe keys.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test ats-lite.test.mjs`

Expected: FAIL because `web/lib/ats-lite.mjs` does not exist.

- [ ] **Step 3: Implement minimal core**

Export `buildAtsLiteProviderStatus`, `mockGreenhouseJob`, `buildAtsJobImportView`, `buildAtsProjectDraft`, `buildAtsDedupeKeys`, and `buildAtsCandidateExportPayload`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test ats-lite.test.mjs`

Expected: PASS.

### Task 2: Server Routes

**Files:**
- Create: `web/app/api/ats-lite/status/route.ts`
- Create: `web/app/api/ats-lite/jobs/import/route.ts`
- Create: `web/app/api/ats-lite/candidates/export/route.ts`
- Modify: `web/lib/shortlist.ts`
- Test: `api-route-copy.test.mjs`

- [ ] **Step 1: Write failing static route tests**

Assert status route calls `buildAtsLiteProviderStatus`, import route calls `mockGreenhouseJob` and `createProject`, export route calls `getItem` and `buildAtsCandidateExportPayload`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test api-route-copy.test.mjs`

Expected: FAIL because routes and `getItem` do not exist.

- [ ] **Step 3: Implement minimal server routes**

Add `getItem(userId, id)` to shortlist persistence. Status route returns provider status. Job import route creates a project from a mock Greenhouse job. Candidate export route returns preview payload and dedupe keys without writing to ATS.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test api-route-copy.test.mjs ats-lite.test.mjs`

Expected: PASS.

### Task 3: UI Entrypoints

**Files:**
- Modify: `web/app/app/settings/page.tsx`
- Modify: `web/app/app/projects/page.tsx`
- Modify: `web/app/app/projects/[id]/page.tsx`
- Test: `api-route-copy.test.mjs`

- [ ] **Step 1: Write failing static UI tests**

Assert Settings fetches `/api/ats-lite/status`, project dialog uses `/api/ats-lite/jobs/import`, and candidate detail uses `/api/ats-lite/candidates/export`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test api-route-copy.test.mjs`

Expected: FAIL because UI wiring does not exist.

- [ ] **Step 3: Implement minimal UI**

Add a Settings provider status block, an import-from-ATS box in the new project dialog, and an Export to ATS preview action in candidate detail.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test api-route-copy.test.mjs ats-lite.test.mjs`

Expected: PASS.

### Task 4: Verification

- [ ] Run targeted tests: `node --test ats-lite.test.mjs api-route-copy.test.mjs`
- [ ] Run build: `npm --prefix web run build`
- [ ] Run diff check: `git diff --check`
