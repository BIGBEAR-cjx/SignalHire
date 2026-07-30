# P2 Credits and Ops Subdomain Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide an atomic Credits ledger, one official operations account at `ops.<primary-domain>`, and a shared server-side reservation API.

**Architecture:** PostgreSQL/RPC owns every balance mutation. `web/lib/credits.ts` exposes server-only reserve/settle/release/grant/read operations; ops routes use a distinct email allowlist guard and the same host-only login cookie policy as the main site.

**Tech Stack:** PostgreSQL migrations/RPC, Next.js App Router, InsForge Auth, Node.js `node:test`.

---

## File structure

- Create: `migrations/20260730..._credits_ops_v1.sql` — accounts, immutable ledger, reservations, audit events, RPCs.
- Create: `web/lib/credits.ts` and `web/lib/credits.mjs` — server adapter and pure input validation.
- Create: `web/lib/ops-auth.ts` — single-account server guard.
- Create: `web/app/ops/login/page.tsx`, `web/app/ops/page.tsx`, `web/app/ops/layout.tsx` — isolated ops shell.
- Create: `web/app/api/ops/whoami/route.ts`, `web/app/api/ops/credits/route.ts`, `web/app/api/ops/credits/[userId]/ledger/route.ts`.
- Modify: `web/.env.example`, `README.md`.
- Test: create `credits-ledger.test.mjs`, `ops-auth.test.mjs`, `ops-credits-route.test.mjs`.

### Task 1: Create atomic ledger schema and contract tests

- [ ] **Step 1: Write failing model tests**

```js
assert.equal(applyCreditTransition({ available: 10, reserved: 0 }, { type: "reserve", amount: 6 }).available, 4);
assert.throws(() => applyCreditTransition({ available: 2, reserved: 0 }, { type: "reserve", amount: 3 }), /insufficient/);
assert.equal(reservationKey({ runId: "run-1" }), "research-run:run-1");
```

- [ ] **Step 2: Run red test**

Run: `node --test credits-ledger.test.mjs`

Expected: FAIL because Credits helpers do not exist.

- [ ] **Step 3: Add migration and pure contract**

Create accounts, append-only ledger, reservation, and ops audit tables with non-negative check constraints and unique idempotency/run constraints. Add transaction/RPC functions `grant_credits`, `reserve_credits`, `settle_credits`, `release_credits`; each locks account rows and emits ledger rows atomically.

- [ ] **Step 4: Verify and commit**

Run: `node --test credits-ledger.test.mjs`

Expected: PASS.

```bash
git add migrations/20260730*_credits_ops_v1.sql web/lib/credits.mjs credits-ledger.test.mjs
git commit -m "feat: add atomic credits ledger contracts"
```

### Task 2: Add server-only Credits service

- [ ] **Step 1: Add failing idempotency tests**

```js
assert.equal((await credits.grant({ userId: "u1", amount: 10, idempotencyKey: "g1" })).available, 10);
assert.equal((await credits.grant({ userId: "u1", amount: 10, idempotencyKey: "g1" })).duplicate, true);
assert.equal((await credits.release({ runId: "r1" })).status, "released");
```

- [ ] **Step 2: Run red test**

Run: `node --test credits-ledger.test.mjs`

Expected: FAIL until service uses RPC adapter.

- [ ] **Step 3: Implement service boundaries**

Expose `readBalance`, `grant`, `reserve`, `settle`, `release`; validate positive integer amounts and opaque idempotency keys, call DB/RPC server-side only, and return safe summaries. Do not import it into browser code.

- [ ] **Step 4: Verify and commit**

Run: `node --test credits-ledger.test.mjs`

Expected: PASS.

```bash
git add web/lib/credits.ts web/lib/credits.mjs credits-ledger.test.mjs
git commit -m "feat: expose server-only credits service"
```

### Task 3: Implement Ops authorization and routes

- [ ] **Step 1: Write failing auth/route tests**

```js
assert.equal(isOpsAdmin({ email: "OPS@EXAMPLE.COM" }, "ops@example.com"), true);
assert.equal(isOpsAdmin({ email: "user@example.com" }, "ops@example.com"), false);
assert.equal(await postGrantAsAnonymous(), 401);
assert.equal(await postGrantAsNonOps(), 403);
```

- [ ] **Step 2: Run red tests**

Run: `node --test ops-auth.test.mjs ops-credits-route.test.mjs`

Expected: FAIL because ops guard/routes do not exist.

- [ ] **Step 3: Implement guard and minimal APIs**

Normalize both emails to lowercase; missing `OPS_ADMIN_EMAIL` always denies. Add `whoami`, account search/read, ledger read and POST grant. POST requires `user_id`, positive `amount`, `reason`, `idempotency_key`; call Credits grant and record an audit event. Return only IDs, email, balances and ledger summaries.

- [ ] **Step 4: Verify and commit**

Run: `node --test ops-auth.test.mjs ops-credits-route.test.mjs credits-ledger.test.mjs`

Expected: PASS.

```bash
git add web/lib/ops-auth.ts web/app/api/ops ops-auth.test.mjs ops-credits-route.test.mjs
git commit -m "feat: restrict credits operations to official account"
```

### Task 4: Add isolated Ops interface and deployment documentation

- [ ] **Step 1: Write a failing component/static route test**

```js
assert.equal(hasUnsafeExternalNext("https://evil.example"), true);
assert.equal(normalizeOpsNext("/ops?user=u1"), "/ops?user=u1");
assert.match(readEnvExample, /OPS_ADMIN_EMAIL=/);
```

- [ ] **Step 2: Run red test**

Run: `node --test ops-auth.test.mjs`

Expected: FAIL until login route/documentation is present.

- [ ] **Step 3: Implement the minimal isolated UI**

Create `/ops/login` and `/ops` with a standalone shell, reuse normal auth at the host, call `/api/ops/whoami`, and show account lookup, balance, ledger, add-Credits form and failed reservations. Restrict next to relative `/ops` paths. Document `OPS_ADMIN_EMAIL`, `OPS_APP_ORIGIN`, same-app ops domain binding, and host-only session requirement.

- [ ] **Step 4: Verify and commit**

Run: `node --test ops-auth.test.mjs ops-credits-route.test.mjs && npm --prefix web run build`

Expected: tests and production build PASS.

```bash
git add web/app/ops web/.env.example README.md ops-auth.test.mjs
git commit -m "feat: add isolated ops credits console"
```
