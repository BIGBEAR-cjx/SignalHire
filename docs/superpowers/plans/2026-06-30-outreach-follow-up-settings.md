# Outreach Follow-Up Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist role-level `auto_follow_up_only` settings on the backend, then use those settings to turn due outreach threads into reviewable follow-up Gmail drafts without auto-sending the first email or any follow-up.

**Architecture:** Add a small `projects.outreach_settings` JSONB column and tenant-scoped API route. Keep scheduling conservative: a cron route scans projects with `auto_follow_up_only=true`, selects due active outreach threads, and writes the next follow-up sequence message into the thread as a review draft. No Gmail send API call is made by the scheduler.

**Tech Stack:** Next.js App Router, Insforge raw SQL/SDK, Node ESM pure modules, existing `outreach_threads` table, `node:test`, Vercel cron.

---

## Scope

Included:

- Backend-persisted role outreach settings.
- Role Workspace reads/saves settings through the backend instead of `localStorage`.
- Pure follow-up draft scheduler that selects sequence step 2 or 3 only.
- Cron endpoint for due follow-up draft generation.
- Guard tests for no first-email automation and no direct Gmail send.

Excluded:

- Direct Gmail Draft API creation.
- Auto-sending follow-ups.
- Auto-sending first emails.
- New provider/contact lookup behavior.

## Files

- Create `migrations/20260630120000_outreach_followup_settings.sql`
  - Adds `projects.outreach_settings jsonb not null default '{}'`.
- Modify `web/lib/projects.ts`
  - Read `outreach_settings`.
  - Add `updateProjectOutreachSettings`.
- Create `web/app/api/projects/[id]/outreach-settings/route.ts`
  - Tenant-scoped `PATCH`.
- Create `web/lib/outreach-followups.mjs`
  - Pure scheduler helpers.
- Create `web/lib/outreach-followups.d.mts`
  - Type declarations.
- Create `web/lib/outreach-followups.ts`
  - DB-backed due queue runner.
- Create `web/app/api/cron/outreach-followups/route.ts`
  - Cron entry point.
- Modify `web/vercel.json`
  - Add daily follow-up scheduling cron.
- Modify `web/app/app/projects/[id]/page.tsx`
  - Use persisted settings and save them via API.
- Create `outreach-followups.test.mjs`
  - Pure scheduling tests.
- Modify `api-route-copy.test.mjs`
  - Guard route wiring and no direct Gmail send.

## Tasks

### Task 1: Persist Role Outreach Settings

**Files:**
- Create: `migrations/20260630120000_outreach_followup_settings.sql`
- Modify: `web/lib/projects.ts`
- Create: `web/app/api/projects/[id]/outreach-settings/route.ts`

- [ ] Add migration:

```sql
alter table public.projects
  add column if not exists outreach_settings jsonb not null default '{}'::jsonb;
```

- [ ] Extend project reads to select and return `outreach_settings`.
- [ ] Add `updateProjectOutreachSettings({ userId, id, settings })` that only writes normalized JSON.
- [ ] Add `PATCH /api/projects/[id]/outreach-settings` with login and tenant checks.
- [ ] Verify with `npm --prefix web run build`.

### Task 2: Pure Follow-Up Draft Scheduler

**Files:**
- Create: `web/lib/outreach-followups.mjs`
- Create: `web/lib/outreach-followups.d.mts`
- Create: `outreach-followups.test.mjs`

- [ ] Test settings-off skip.
- [ ] Test not-due skip.
- [ ] Test stopped/replied/bounced skip.
- [ ] Test due sent/contacted thread schedules step 2 as `follow_up_due`.
- [ ] Test prior step 2 marker schedules step 3 next.
- [ ] Test scheduler never returns step 1.
- [ ] Implement minimal pure helpers:
  - `buildDueFollowUpDraftPatch`
  - `buildFollowUpDraftRunSummary`

### Task 3: DB Runner And Cron

**Files:**
- Create: `web/lib/outreach-followups.ts`
- Create: `web/app/api/cron/outreach-followups/route.ts`
- Modify: `web/vercel.json`
- Modify: `api-route-copy.test.mjs`

- [ ] Query projects where `outreach_settings->>'auto_follow_up_only' = 'true'`.
- [ ] Query due outreach threads under those projects with active statuses and `next_follow_up_at <= now`.
- [ ] Apply pure patch via `updateOutreachThread`.
- [ ] Cron route checks `CRON_SECRET` like existing cron routes.
- [ ] Guard test ensures the cron imports the runner and does not import Gmail send helpers.

### Task 4: Role Workspace UI

**Files:**
- Modify: `web/app/app/projects/[id]/page.tsx`

- [ ] Add `outreach_settings` to `ProjectDetail`.
- [ ] Initialize `GmailOutreachPanel` from backend settings.
- [ ] Replace `localStorage` writes with `PATCH /api/projects/[id]/outreach-settings`.
- [ ] Keep copy explicit that first email and follow-ups are drafts for review, not automatic sends.

### Task 5: Verification

Run:

```bash
git diff --check
node --test outreach-settings.test.mjs outreach-followups.test.mjs api-route-copy.test.mjs
npm --prefix web run build
```

Expected:

- All tests pass.
- Build passes.
- No scheduler code imports Gmail send functions.
