# Sequence Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add role-level outreach sequence analytics without adding open tracking pixels or bulk-send behavior.

**Architecture:** Use a pure `sequence-analytics` view builder over existing `outreach_threads`, return it from project detail API, render one compact panel between Gmail Outreach and Inbox Agent, and add aggregate analytics lines to the client digest.

**Tech Stack:** Next.js App Router, existing outreach thread persistence, React project workspace, Node test runner.

---

### Task 1: Core Analytics Builder

**Files:**
- Create: `web/lib/sequence-analytics.mjs`
- Create: `web/lib/sequence-analytics.d.ts`
- Create: `web/lib/sequence-analytics.d.mts`
- Test: `sequence-analytics.test.mjs`

- [ ] Write failing tests for summary, open unavailable, step performance, and next actions.
- [ ] Run `node --test sequence-analytics.test.mjs` and verify it fails because the module is missing.
- [ ] Implement `buildSequenceAnalyticsView({ roleId, threads, now, locale })`.
- [ ] Run `node --test sequence-analytics.test.mjs` and verify it passes.

### Task 2: API and Digest Wiring

**Files:**
- Modify: `web/app/api/projects/[id]/route.ts`
- Modify: `web/lib/outreach-activity-digest.mjs`
- Modify: `web/lib/outreach-activity-digest.d.ts`
- Modify: `web/lib/outreach-activity-digest.d.mts`
- Test: `api-route-copy.test.mjs`
- Test: `outreach-activity-digest.test.mjs`

- [ ] Add failing tests asserting project GET returns `sequenceAnalytics` and digest includes aggregate analytics without private notes.
- [ ] Implement route wiring from `listOutreachThreads` plus `buildSequenceAnalyticsView`.
- [ ] Add digest summary lines.
- [ ] Run `node --test sequence-analytics.test.mjs outreach-activity-digest.test.mjs api-route-copy.test.mjs`.

### Task 3: Project Workspace Panel

**Files:**
- Modify: `web/app/app/projects/[id]/page.tsx`
- Test: `api-route-copy.test.mjs`

- [ ] Add failing static test asserting the panel renders between Gmail Outreach and Inbox Agent.
- [ ] Implement `SequenceAnalyticsPanel`.
- [ ] Run targeted tests and build.
