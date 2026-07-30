# P1 Talent Monitor v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn search tasks into configurable, auditable Talent Monitors that discover evidence changes without automatic outreach.

**Architecture:** Extend `search_tasks` with next-run configuration and create immutable `search_task_runs` snapshots. The existing research run remains the execution unit; monitor entry points use the shared Credits reservation service and worker completion settles exactly one reservation.

**Tech Stack:** PostgreSQL migrations, Next.js routes, Node.js tests, existing `search-tasks`, queue, worker and project UI.

---

## File structure

- Create: `migrations/20260730..._talent_monitor_v2.sql` — task configuration/run-history fields and constraints.
- Modify: `web/lib/search-tasks.mjs`, `web/lib/search-tasks.ts` — normalize, schedule, snapshot, dedupe.
- Modify: `web/app/api/search-tasks/route.ts`, `web/app/api/search-tasks/[id]/route.ts`, `web/app/api/search-tasks/[id]/run/route.ts`, `web/app/api/cron/search-tasks/route.ts`.
- Modify: `worker/index.mjs` — hard candidate cap and settlement/release hook.
- Modify: `web/app/app/projects/[id]/page.tsx` — monitor detail/history/settings.
- Test: `search-tasks.test.mjs`, `worker-stream-timeout.test.mjs`; create `talent-monitor-v2.test.mjs` and `talent-monitor-routes.test.mjs`.

### Task 1: Add Monitor config, snapshots, and no-drift scheduling

- [ ] **Step 1: Write failing pure tests**

```js
assert.equal(normalizeMonitorInput({ candidate_batch_size: 12 }).candidate_batch_size, 10);
assert.equal(buildNextRunAt({ frequency: "daily", timezone: "Asia/Shanghai", scheduleTime: "09:00", now }), "2026-07-31T01:00:00.000Z");
assert.equal(nextRunAfterPatch(existing, { name: "Renamed" }), existing.next_run_at);
assert.equal(snapshotMonitorConfig(existing).candidate_batch_size, 20);
```

- [ ] **Step 2: Run red tests**

Run: `node --test search-tasks.test.mjs talent-monitor-v2.test.mjs`

Expected: FAIL for absent normalized monitor fields/snapshot logic.

- [ ] **Step 3: Add migration and model logic**

Add batch size, timezone, schedule time, monthly limit/used/reserved, notification, pause reason, last run status and `search_task_runs`. Allow only batch `5|10|20`, frequency manual/daily/weekly, IANA timezone values provided by server validation. Recompute `next_run_at` only when schedule fields change; persist a config snapshot per started run.

- [ ] **Step 4: Verify and commit**

Run: `node --test search-tasks.test.mjs talent-monitor-v2.test.mjs`

Expected: PASS.

```bash
git add migrations/20260730*_talent_monitor_v2.sql web/lib/search-tasks.mjs web/lib/search-tasks.ts search-tasks.test.mjs talent-monitor-v2.test.mjs
git commit -m "feat: add talent monitor configuration snapshots"
```

### Task 2: Reserve Credits and atomically create one monitor run

- [ ] **Step 1: Write failing orchestration tests**

```js
assert.equal((await startMonitorRun(task, deps)).status, "queued");
assert.equal((await startMonitorRun(overBudgetTask, deps)).status, "paused");
assert.equal(deps.enqueue.calls.length, 0, "insufficient credits must not enqueue");
assert.equal((await startMonitorRun(task, concurrentDeps)).duplicate, true);
```

- [ ] **Step 2: Run red tests**

Run: `node --test talent-monitor-v2.test.mjs talent-monitor-routes.test.mjs`

Expected: FAIL because current run path does not reserve/record snapshots.

- [ ] **Step 3: Implement a single start path**

Route manual, Role Agent and cron calls through `startMonitorRun`. It first checks task/project state and monthly limit, calls `credits.reserve`, creates a unique active `search_task_runs` row with snapshot and reservation reference, then enqueues. A duplicate active run returns its existing summary; insufficient balance/budget sets pause reason and never enqueues.

- [ ] **Step 4: Verify and commit**

Run: `node --test talent-monitor-v2.test.mjs talent-monitor-routes.test.mjs search-tasks.test.mjs`

Expected: PASS.

```bash
git add web/lib/search-tasks.ts web/app/api/search-tasks web/app/api/cron/search-tasks/route.ts talent-monitor-v2.test.mjs talent-monitor-routes.test.mjs
git commit -m "feat: reserve credits before talent monitor runs"
```

### Task 3: Enforce candidate cap and settle immutable run history

- [ ] **Step 1: Write failing worker/run-history tests**

```js
assert.equal(limitMonitorCandidates(candidates, 5).length, 5);
assert.equal((await settleMonitorRun({ status: "done" }, deps)).credit_status, "settled");
assert.equal((await settleMonitorRun({ status: "failed" }, deps)).credit_status, "released");
```

- [ ] **Step 2: Run red tests**

Run: `node --test talent-monitor-v2.test.mjs worker-stream-timeout.test.mjs`

Expected: FAIL until worker uses the stored snapshot and settlement hook.

- [ ] **Step 3: Implement execution completion behavior**

Read batch size from immutable task-run snapshot, hard-cap archived candidates, classify new/updated/seen/skip, and call Credits settle only after completed persistence. On terminal failed/cancelled states call release once. Do not send outreach; notification payloads only include new/evidence-updated candidates and a dedupe key.

- [ ] **Step 4: Verify and commit**

Run: `node --test talent-monitor-v2.test.mjs worker-stream-timeout.test.mjs search-tasks.test.mjs`

Expected: PASS.

```bash
git add worker/index.mjs web/lib/search-tasks.ts talent-monitor-v2.test.mjs worker-stream-timeout.test.mjs
git commit -m "feat: settle talent monitor run history"
```

### Task 4: Expose Monitor detail and history safely

- [ ] **Step 1: Write failing view/route tests**

```js
assert.equal(buildMonitorView(task).runs[0].config_snapshot.candidate_batch_size, 10);
assert.equal(buildMonitorView(task).runs[0].outreach_sent, undefined);
assert.equal(await patchOtherUsersMonitor(), 404);
```

- [ ] **Step 2: Run red tests**

Run: `node --test talent-monitor-v2.test.mjs talent-monitor-routes.test.mjs`

Expected: FAIL until API and UI return the new sanitized model.

- [ ] **Step 3: Implement minimum UI/API**

Extend create/PATCH responses and project Monitor card with an editable detail drawer, run history, research run links, counts, Credits summary and pause reason. Do not add hour-level schedule controls or an outreach CTA.

- [ ] **Step 4: Verify and commit**

Run: `node --test talent-monitor-v2.test.mjs talent-monitor-routes.test.mjs search-tasks.test.mjs && npm --prefix web run build`

Expected: tests and build PASS.

```bash
git add web/app/app/projects/[id]/page.tsx web/app/api/search-tasks web/lib/search-tasks.ts talent-monitor-v2.test.mjs talent-monitor-routes.test.mjs
git commit -m "feat: show talent monitor run history"
```
