# Juicebox P2 Network Referral Path Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the first Network / Referral Path slice: normalize user-provided network seeds, generate candidate referral paths, and surface client-safe summaries in Smart Report.

**Architecture:** Keep P2a as a pure view-model layer with no new tables and no LinkedIn scraping. `web/lib/referral-paths.mjs` accepts candidate rows plus user-provided seed rows, matches explicit LinkedIn/manual seeds and shared company/school/project context, and emits `ReferralPathView[]`. `web/lib/smart-report.mjs` optionally consumes referral paths and displays client-safe summaries.

**Tech Stack:** Next.js App Router, ESM helper modules, TypeScript declaration files, Node `node:test`.

---

## File Structure

- Create `web/lib/referral-paths.mjs`: pure seed normalizer and referral path builder.
- Create `web/lib/referral-paths.d.ts` and `web/lib/referral-paths.d.mts`: TS declarations.
- Create `referral-paths.test.mjs`: tests for manual LinkedIn seed, shared company/school/project, privacy guardrails, and intro snippet.
- Modify `web/lib/smart-report.mjs`: add optional client-safe referral summary.
- Modify `web/lib/smart-report.d.ts` and `web/lib/smart-report.d.mts`: add `referral_summary`.
- Modify `web/components/result.tsx`: render Smart Report referral summary when present.
- Modify `api-route-copy.test.mjs`: wiring assertion.

## Task 1: Referral Path View Model

**Files:**
- Create: `referral-paths.test.mjs`
- Create: `web/lib/referral-paths.mjs`
- Create: `web/lib/referral-paths.d.ts`
- Create: `web/lib/referral-paths.d.mts`

- [ ] **Step 1: Write failing test**

Create `referral-paths.test.mjs` with tests that import `buildReferralPathViews` from `web/lib/referral-paths.mjs`.

Expected behaviors:
- A manual LinkedIn seed that matches a candidate LinkedIn URL creates a `manual_seed` path.
- A shared company seed creates a `shared_company` path with “may have shared context” language.
- Shared school/project seeds create matching paths.
- Private fields such as email/phone/private_notes do not appear in `intro_snippet` or `shared_context`.
- Each candidate returns at most two paths.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test referral-paths.test.mjs`

Expected: FAIL with module not found for `web/lib/referral-paths.mjs`.

- [ ] **Step 3: Implement minimal pure model**

Create `web/lib/referral-paths.mjs` with:
- `normalizeNetworkSeed(seed)`
- `normalizeNetworkSeeds(seeds)`
- `buildReferralPathViews({ candidates, networkSeeds, locale })`

The implementation must:
- normalize names, companies, schools, projects, LinkedIn URLs.
- match candidate `links.linkedin`, `linkedin_url`, or `contact_profile.linkedin_url`.
- match `current_company` / `company`, `schools` / `education`, and `projects`.
- create safe snippets that say “may have shared context” unless the seed relation is explicit.
- strip email, phone, and private notes from output.
- limit to two paths per candidate.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test referral-paths.test.mjs`

Expected: PASS.

## Task 2: Smart Report Referral Summary

**Files:**
- Modify: `smart-report.test.mjs`
- Modify: `web/lib/smart-report.mjs`
- Modify: `web/lib/smart-report.d.ts`
- Modify: `web/lib/smart-report.d.mts`
- Modify: `web/components/result.tsx`
- Modify: `api-route-copy.test.mjs`

- [ ] **Step 1: Write failing tests**

Extend `smart-report.test.mjs` with a test that passes `network_seeds` and asserts:
- `report.referral_summary.length === 1`
- summary contains candidate name and shared company context.
- summary does not contain email/private note.

Extend `api-route-copy.test.mjs` with a wiring assertion that `SmartReportPanel` renders `referral_summary`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test smart-report.test.mjs api-route-copy.test.mjs --test-name-pattern "referral|Smart Report"`

Expected: FAIL because Smart Report does not yet expose referral summary.

- [ ] **Step 3: Implement Smart Report integration**

Modify `web/lib/smart-report.mjs`:
- import `buildReferralPathViews`.
- call it with `result.candidates` and `result.network_seeds || result.networkSeeds`.
- add `referral_summary` as client-safe path rows.

Modify `web/components/result.tsx`:
- render `report.referral_summary` as a compact referral path block.

- [ ] **Step 4: Run targeted tests**

Run: `node --test referral-paths.test.mjs smart-report.test.mjs api-route-copy.test.mjs --test-name-pattern "referral|Smart Report"`

Expected: PASS.

## Task 3: Verification

**Files:**
- Existing tests only.

- [ ] **Step 1: Run focused phase tests**

Run: `node --test referral-paths.test.mjs smart-report.test.mjs api-route-copy.test.mjs`

Expected: PASS.

- [ ] **Step 2: Run regression suite touched by P1/P2**

Run: `node --test api-route-copy.test.mjs candidate-graph.test.mjs smart-report.test.mjs referral-paths.test.mjs`

Expected: PASS.

- [ ] **Step 3: Run build**

Run: `npm --prefix web run build`

Expected: PASS.
