# P0 Client Portal Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make account-authorized client delivery and report feedback secure, version-specific, and auditable.

**Architecture:** Keep the existing `/client` workspace and access-policy model. Server routes derive the feedback actor from the session, require a report belonging to the authorized project, and reuse client-safe projections.

**Tech Stack:** Next.js App Router, InsForge session, Node.js tests, existing client portal workspace/report feedback libraries.

---

## File structure

- Modify: `web/app/api/client-portal/projects/[id]/feedback/route.ts` — authenticated actor/report-version handling.
- Modify: `web/app/client/projects/[id]/page.tsx` — report selection and no client-supplied actor.
- Modify: `web/app/r/[id]/page.tsx` and its feedback route — allow authorized account feedback.
- Modify: `web/lib/client-report-feedback.mjs` — normalize only server-selected actor.
- Test: `client-portal-workspace.test.mjs`, `report-share-access.test.mjs`, create `client-portal-feedback-route.test.mjs`.

### Task 1: Make feedback actor and report version server-owned

- [ ] **Step 1: Write failing route/library tests**

```js
assert.equal(normalizeClientFeedback({ reviewer: "forged@x.com" }, { actorEmail: "real@client.ai", reportId: "r1" }).actor, "real@client.ai");
assert.equal(normalizeClientFeedback({}, { actorEmail: "", reportId: "r1" }), null);
assert.equal(normalizeClientFeedback({}, { actorEmail: "real@client.ai", reportId: "" }), null);
```

- [ ] **Step 2: Run red tests**

Run: `node --test client-portal-feedback-route.test.mjs`

Expected: FAIL because the server context argument is absent.

- [ ] **Step 3: Implement minimal normalization and route validation**

Change the feedback API body to accept only `report_id`, `sentiment`, `note`, and `locale`. Load `getUser()`, authorize the project, confirm `report_id` belongs to it, then pass `{actorEmail: user.email, reportId}` to normalization/persistence.

- [ ] **Step 4: Verify focused tests**

Run: `node --test client-portal-feedback-route.test.mjs client-portal-workspace.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/lib/client-report-feedback.mjs web/app/api/client-portal/projects/[id]/feedback/route.ts client-portal-feedback-route.test.mjs client-portal-workspace.test.mjs
git commit -m "fix: bind client feedback to authenticated actor"
```

### Task 2: Select report versions in the portal and align report-page feedback

- [ ] **Step 1: Write failing view-model/route tests**

```js
assert.equal(buildClientPortalProjectView(input).reports[0].id, "report-1");
assert.equal(canSubmitAccountFeedback({ authorized: true, token: "" }), true);
assert.equal(canSubmitAccountFeedback({ authorized: false, token: "" }), false);
```

- [ ] **Step 2: Run red test**

Run: `node --test client-portal-feedback-route.test.mjs report-share-access.test.mjs`

Expected: FAIL until account access is included in feedback authorization.

- [ ] **Step 3: Implement minimal UI and access change**

Render a report-version selector from the existing client-safe `reports` list, defaulting to newest. Submit selected `report_id`; remove `reviewer` from the client request. On `/r/[id]`, permit the existing authorized customer-account branch to reach feedback while preserving token access and refusing anonymous access.

- [ ] **Step 4: Verify focused tests**

Run: `node --test client-portal-feedback-route.test.mjs report-share-access.test.mjs client-portal-workspace.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/app/client/projects/[id]/page.tsx web/app/r/[id]/page.tsx web/app/api/client-portal/projects/[id]/feedback/route.ts client-portal-feedback-route.test.mjs report-share-access.test.mjs
git commit -m "feat: attach portal feedback to report versions"
```

### Task 3: Protect revocation and safe response contracts

- [ ] **Step 1: Add failing negative/serialization tests**

```js
assert.equal(await getProjectAfterRevocation(), 403);
assert.equal(JSON.stringify(clientPayload).includes("allowed_domains"), false);
assert.equal(JSON.stringify(clientPayload).includes("execution_log"), false);
```

- [ ] **Step 2: Run red test**

Run: `node --test client-portal-feedback-route.test.mjs client-portal-workspace.test.mjs`

Expected: FAIL for whichever response leaks or does not re-check access.

- [ ] **Step 3: Implement only missing re-check/projection logic**

Ensure all portal feedback/report reads call the same project authorization guard immediately before reading/writing and preserve existing `safeText` projection. Do not add a new customer data model.

- [ ] **Step 4: Verify and commit**

Run: `node --test client-portal-feedback-route.test.mjs client-portal-workspace.test.mjs report-share-access.test.mjs`

Expected: PASS.

```bash
git add web/app/api/client-portal web/app/r/[id]/page.tsx web/lib/client-portal-workspace.mjs client-portal-feedback-route.test.mjs client-portal-workspace.test.mjs report-share-access.test.mjs
git commit -m "test: lock down revoked client portal access"
```
