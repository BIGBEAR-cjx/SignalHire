# Verification

## Static checks

Run the web checks:

```bash
cd web
npm run lint
npm run build
```

Run the worker syntax checks:

```bash
cd worker
node --check index.mjs
node --check lib.mjs
```

Run the shared job-state checks after queue or worker changes:

```bash
node --test job-state.test.mjs
```

## Known local environment note

In restricted sandboxes, `next build` can fail with a Turbopack panic mentioning `binding to a port` and `Operation not permitted`. If that happens, rerun the build in an unrestricted local terminal before treating it as a product failure.

## Checks requiring real credentials

Credential-dependent checks require `web/.env.local` with Insforge and MiroMind values.

## Seed demo reports

Command:

```bash
cd web && node --env-file=.env.local scripts/seed-db.mjs
```

Expected: all three JSON seed files print `ok`.

## Check research_runs schema

Command:

```bash
cd web && npm run verify:schema
```

Expected: `research_runs schema ok`. If it fails with a missing column, add the v1 columns listed in `docs/insforge-research-runs.md` before running live jobs.

## Run web app

Command:

```bash
cd web && npm run dev
```

Expected: the landing page loads, cached examples are available, seeded history is visible, and share report links work.

## Run worker

Command:

```bash
cd worker && node --env-file=../web/.env.local index.mjs
```

Expected: logs show worker startup and processing progress, with status updates reflecting the worker behavior.

## Research job reliability checks

For a non-cached query with real credentials:

- `/api/search` or `/api/verify` returns `{ queued: true, jobId }`.
- `/api/status?id=<jobId>` returns `status_view.phase` as the job moves through `queued`, `running`, `retrying`, `done`, or `error`.
- If the worker crashes while a row is `running`, a later worker loop moves the stale row back to `retrying`.
- If a row ends in `error`, `POST /api/retry` with `{ "id": "<jobId>" }` returns it to `queued`.

Scripted checks:

```bash
cd web
npm run verify:schema
npm run verify:live
npm run verify:retry
```

`verify:live` expects the web server and worker to already be running. It submits a unique non-cached job and polls `/api/status` until `done` or `error`. `verify:retry` creates one synthetic `error` row, calls `/api/retry`, checks the row returns to `queued`, then deletes the synthetic row.
