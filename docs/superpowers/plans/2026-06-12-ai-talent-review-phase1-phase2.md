# AI Talent Review Phase 1/2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the current search result surface into a tighter AI talent evidence review workflow and add the first AI-vertical profile cache primitives.

**Architecture:** Keep changes surgical. Add pure view-model helpers in `web/lib/talent-profile.mjs`, render them from existing result/research components, and keep internal search diagnostics out of public report pages. Reuse existing shortlist, backfill, outreach, feedback, and report components instead of creating a new module stack.

**Tech Stack:** Next.js 16, React 19, Node test runner, existing Tailwind/global CSS tokens.

---

### Task 1: Public Delivery Report Surface

**Files:**
- Modify: `web/app/r/[id]/page.tsx`
- Test: `api-route-copy.test.mjs`

- [x] Add a regression test that `/r/[id]` search reports render `ShortlistDeliveryReportView` and candidate evidence, but do not render `SearchPlanView`, `SourceExecutionView`, `CoverageBackfillView`, or `TalentMapView`.
- [x] Update the public search report page to hide internal search process views and keep only the delivery summary plus per-candidate evidence/risk/profile views.
- [x] Run `node --test api-route-copy.test.mjs`.

### Task 2: Candidate Review Brief

**Files:**
- Modify: `web/lib/talent-profile.mjs`
- Modify: `web/lib/talent-profile.d.ts`
- Modify: `web/components/result.tsx`
- Modify: `web/components/ResearchTool.tsx`
- Test: `talent-profile.test.mjs`

- [x] Add `buildCandidateReviewBrief({ result, candidate, locale })` with exactly three sections: why recommended, evidence strength, next action.
- [x] Render this brief above the heavier candidate profile in `CandidateReviewFlow`.
- [x] Run `node --test talent-profile.test.mjs`.

### Task 3: AI Vertical Profile Cache Slice

**Files:**
- Modify: `web/lib/talent-profile.mjs`
- Modify: `web/lib/talent-profile.d.ts`
- Modify: `web/components/result.tsx`
- Test: `talent-profile.test.mjs`

- [x] Add a focused AI vertical taxonomy for `LLM infra`, `RAG`, `agent`, `multimodal`, `eval`, `AI product`, and `AI GTM`.
- [x] Add `buildCandidateProfileCacheEntry({ result, candidate })` to normalize evidence URLs, source types, vertical tags, confidence, and reusable search text.
- [x] Add `buildSimilarCandidateSuggestions({ result, candidate })` to surface candidates sharing vertical tags, source types, or AI directions.
- [x] Add a compact `AIVerticalProfileView` inside candidate profile rendering.
- [x] Run `node --test talent-profile.test.mjs`.

### Task 4: JD Upload For Search Input

**Files:**
- Modify: `web/components/research-workspace.tsx`
- Modify: `web/components/ResearchTool.tsx`
- Modify: `web/lib/i18n.mjs`
- Test: `api-route-copy.test.mjs`

- [x] Reuse the existing text extraction endpoint/client helper for search-mode JD files.
- [x] In search mode, show a single JD upload/drop zone that fills the search brief and generates a search plan, instead of auto-running.
- [x] Keep verify-mode resume/supporting-material upload behavior unchanged.
- [x] Run `node --test api-route-copy.test.mjs`.

### Task 5: Verification

**Files:**
- No code changes expected.

- [x] Run `node --test talent-profile.test.mjs api-route-copy.test.mjs research-loop.test.mjs evidence-priority.test.mjs`.
- [x] Run `npm --prefix web run build`.
- [x] Start `npm --prefix web run dev` and browser-check `/app/search`; auth blocked the authenticated workspace view, and the login modal loaded without console errors.

### Task 6: Database Expansion Research

**Files:**
- Create: `docs/research/candidate-database-expansion.md`

- [x] Document paid and non-paid source expansion options only after Tasks 1-5 pass.
- [x] Compare sources by coverage, AI-talent signal quality, enrichment/contact risk, cost posture, and integration order.
- [x] Recommend a sequence that does not move SignalHire into a contact-data/outreach-first position too early.

### Follow-up completed in continuation

- [x] Persist profile cache rows into `candidate_profiles` from both `saveRun` and the async worker completion path.
- [x] Persist evidence URLs as structured `candidate_evidence_sources` rows with source family, coverage group, source type, host, and platform ids.
- [x] Add cached-candidate recall ranking and pass top cache hints into queued worker jobs so next-round search can reuse prior evidence without stopping at old candidates.
- [x] Add a tested open-source evidence source surface for GitHub, Hugging Face, OpenAlex, Semantic Scholar, and OpenReview request plans and response normalization.
- [x] Execute open-source evidence requests before worker search, tolerate per-provider failures, and pass normalized leads into the prompt with optional GitHub/Semantic Scholar API keys.
- [x] Store normalized open-source precheck leads in `open_evidence_leads` before identity resolution.
- [x] Add provider-specific rate-limit budgets, retry/backoff policy, and observability for open-source precheck jobs.
