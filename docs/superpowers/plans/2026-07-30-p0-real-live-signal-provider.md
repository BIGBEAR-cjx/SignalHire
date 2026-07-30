# P0 Real Live Signal Provider v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist evidence-backed external live signals and make them affect Role Agent `why now` safely.

**Architecture:** Preserve the HTTP provider contract but validate each returned signal before a transactional upsert into `candidate_live_signals`. The graph reads only non-expired persisted signals; fallback providers remain blocked for production evidence rather than fabricating freshness.

**Tech Stack:** PostgreSQL migrations, Next.js server routes, Node.js tests, existing CandidateGraph and Role Agent workspace.

---

## File structure

- Create: `migrations/20260730..._candidate_live_signals.sql` — table, uniqueness, indexes.
- Create: `web/lib/candidate-live-signals.mjs` and `.ts` — validation, read/write repository.
- Modify: `web/lib/live-signal-refresh.mjs`, `web/lib/live-signal-refresh.ts` — provider capability/validation and no synthetic success.
- Modify: `web/lib/role-agent-runner.mjs`, `web/lib/projects.ts`, `web/lib/role-agent-workspace.mjs` — ingest then project signals.
- Test: `live-signal-refresh.test.mjs`, `role-agent-runner.test.mjs`, create `candidate-live-signals.test.mjs`.

### Task 1: Define durable, validated signal records

- [ ] **Step 1: Write failing validation tests**

```js
assert.equal(normalizeCandidateLiveSignal({ source_url: "", candidate_merge_key: "ada" }), null);
assert.equal(normalizeCandidateLiveSignal(validSignal).source_url, "https://github.com/ada/repo");
assert.equal(liveSignalKey(validSignal), "github:ada:https://github.com/ada/repo:hash-1");
```

- [ ] **Step 2: Run red test**

Run: `node --test candidate-live-signals.test.mjs`

Expected: FAIL with missing module/exports.

- [ ] **Step 3: Add migration and pure validation**

Create `candidate_live_signals` with `user_id`, `project_id`, `candidate_merge_key`, `provider`, `type`, `source_url`, `summary`, `confidence`, `observed_at`, `expires_at`, `content_hash`, timestamps; unique `(provider,candidate_merge_key,source_url,content_hash)` and index `(project_id,expires_at)`. Normalize only signals with stable key, HTTPS URL, observed time, summary and expiry.

- [ ] **Step 4: Verify and commit**

Run: `node --test candidate-live-signals.test.mjs`

Expected: PASS.

```bash
git add migrations/20260730*_candidate_live_signals.sql web/lib/candidate-live-signals.mjs web/lib/candidate-live-signals.ts candidate-live-signals.test.mjs
git commit -m "feat: add validated candidate live signal records"
```

### Task 2: Persist provider refreshes before events

- [ ] **Step 1: Write failing runner tests**

```js
assert.equal(await refreshAndPersist(validProviderResult, deps).persisted, 1);
assert.equal(await refreshAndPersist(invalidProviderResult, deps).persisted, 0);
assert.equal(event.result.signal_ids.length, 1);
```

- [ ] **Step 2: Run red tests**

Run: `node --test live-signal-refresh.test.mjs role-agent-runner.test.mjs candidate-live-signals.test.mjs`

Expected: FAIL because refresh currently records counts only.

- [ ] **Step 3: Implement ingestion ordering**

Map provider candidate IDs to existing CandidateGraph merge keys, validate, upsert, then build the Role Agent event with persisted IDs/counts. Treat no configured real provider as `blocked`; preserve sanitized partial failures and never overwrite valid prior rows.

- [ ] **Step 4: Verify and commit**

Run: `node --test live-signal-refresh.test.mjs role-agent-runner.test.mjs candidate-live-signals.test.mjs`

Expected: PASS.

```bash
git add web/lib/live-signal-refresh.mjs web/lib/live-signal-refresh.ts web/lib/role-agent-runner.mjs web/lib/candidate-live-signals.* live-signal-refresh.test.mjs role-agent-runner.test.mjs candidate-live-signals.test.mjs
git commit -m "feat: persist verified live signal refreshes"
```

### Task 3: Project persisted signals into `why now`

- [ ] **Step 1: Add failing graph/workspace tests**

```js
assert.equal(projectLiveSignals([expiredSignal], now).length, 0);
assert.match(buildRoleAgentWorkspace(withFreshSignal).next_actions[0].reason, /GitHub/);
assert.equal(buildRoleAgentWorkspace(noProvider).signal_refresh.status, "blocked");
```

- [ ] **Step 2: Run red tests**

Run: `node --test role-agent-workspace.test.mjs candidate-live-signals.test.mjs`

Expected: FAIL until graph projection consumes persisted rows.

- [ ] **Step 3: Implement projection and minimal UI wiring**

Load non-expired rows per project, merge by existing stable key, expose source URL/observed/expiry/confidence to the Role Agent view, and render source links/status without provider payloads. Do not make signals send outreach.

- [ ] **Step 4: Verify and commit**

Run: `node --test role-agent-workspace.test.mjs role-agent-runner.test.mjs live-signal-refresh.test.mjs candidate-live-signals.test.mjs`

Expected: PASS.

```bash
git add web/lib/projects.ts web/lib/role-agent-workspace.mjs web/app/app/projects/[id]/page.tsx web/lib/candidate-live-signals.* role-agent-workspace.test.mjs candidate-live-signals.test.mjs
git commit -m "feat: show persisted evidence live signals in role agent"
```
