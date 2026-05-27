# Insforge research_runs Contract

`research_runs` is both the report cache and the async job queue for generated research reports. API routes reuse completed rows by cache key, enqueue cache misses as jobs, the worker completes those jobs, and report/status pages read the same table.

## Required Columns

| Column | Required behavior |
| --- | --- |
| `id` | Stable, URL-safe row identifier used by `/r/[id]` report links and `/api/status?id=...` polling. |
| `cache_key` | Unique cache key in the form `${kind}:${flat_key}`. Used for cache lookup and upsert conflict handling. |
| `kind` | Run type. Current values are `search` and `verify`; controls prompts and report rendering. |
| `flat_key` | Normalized query key paired with `kind` to build `cache_key`. |
| `query_text` | Original search or verification text used by the worker and report page. |
| `label` | Short display label for report metadata and recent-run history. |
| `summary` | Short report summary; queued rows may use an in-progress placeholder until completion. |
| `result` | Generated report payload. `null` while queued/running; populated when `status` is `done`. |
| `stats` | Run statistics such as search and fetch counts. |
| `status` | Queue state: `queued`, `running`, `done`, or `error`. |
| `progress` | Worker progress payload for polling clients, including counters and recent steps when available. |
| `error` | Error message for failed jobs; `null` for queued/running/done rows. |
| `created_at` | Creation timestamp used by the worker to claim queued jobs oldest first. |
| `updated_at` | Last-update timestamp used for cache/report freshness and recent-run ordering. |

## Constraints

- `cache_key` must be unique so cache writes and job enqueues can use upsert with `onConflict: "cache_key"`.
- `id` must be stable and URL-safe because it is persisted in shareable report URLs and polling URLs.

## State Flow

API routes enqueue cache misses as rows with `status = "queued"`. The worker claims queued rows and moves them through `queued -> running -> done` on success, or `queued -> running -> error` on failure. The status route reads `status`, `progress`, `result`, and `error` by `id`; the report page reads the completed report by `id`.

## Seeded Demo Rows

Seed demo cache rows with:

```bash
cd web
node --env-file=.env.local scripts/seed-db.mjs
```
