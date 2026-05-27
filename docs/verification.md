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
