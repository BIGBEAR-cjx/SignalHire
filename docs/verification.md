# Verification

## Static checks

Run the web checks:

```bash
cd web
npm run lint
npm run build
npm run verify:worker-health
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

## Worker health and production monitoring

Public health summary:

```bash
curl -fsS "$APP_BASE_URL/api/worker-health"
```

Scripted check:

```bash
cd web
APP_BASE_URL=https://your-production-host npm run verify:worker-health
```

Expected: JSON with `"ok": true`. A non-2xx response means queued, retrying, or running jobs are older
than the shared stale threshold, or the server cannot read Insforge.

Vercel Cron calls `/api/cron/worker-health` on the production deployment. It requires `CRON_SECRET`
in the Vercel environment because the route checks `Authorization: Bearer $CRON_SECRET`. The current
`web/vercel.json` schedule is daily (`0 0 * * *`) so it remains valid on Vercel Hobby; use the
`verify:worker-health` script for on-demand checks during incidents.

Railway production worker check:

```bash
npx -y @railway/cli@4.65.0 service status --project e994adce-23d2-40e4-bedb-67ab7031b415 --service SignalHire --environment production --json
```

The Railway CLI mapping observed on 2026-05-28 was project `sublime-enthusiasm`, service `SignalHire`,
environment `production`. The worker Docker build context is `worker/`, so worker code must not import
files from `../web`.

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

`verify:live` keeps the human-facing query stable and realistic. It sends a private
`x-signalhire-verify-run-id` header to bypass the DB cache for smoke tests without putting timestamps
or random IDs into the prompt that MiroMind researches. It also retries transient fetch/TLS/5xx
failures with exponential backoff.
