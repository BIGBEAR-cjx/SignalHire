import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildCandidateLiveSignalUpsertRows,
  attachActiveCandidateLiveSignals,
  isCandidateLiveSignalActive,
  liveSignalKey,
  normalizeCandidateLiveSignal,
} from "./web/lib/candidate-live-signals.mjs";

const validSignal = {
  user_id: "user-1",
  project_id: "project-1",
  candidate_merge_key: "ada",
  provider: "github",
  type: "repository_activity",
  source_url: "https://github.com/ada/repo",
  summary: "Published a repository update.",
  confidence: "high",
  observed_at: "2026-07-30T10:00:00.000Z",
  expires_at: "2026-08-06T10:00:00.000Z",
  content_hash: "hash-1",
};

test("accepts an evidence-backed live signal with a stable persistence key", () => {
  const normalized = normalizeCandidateLiveSignal(validSignal);

  assert.equal(normalized.source_url, "https://github.com/ada/repo");
  assert.equal(liveSignalKey(validSignal), "github:ada:https://github.com/ada/repo:hash-1");
});

test("rejects signals missing required evidence or identity fields", () => {
  assert.equal(normalizeCandidateLiveSignal({ source_url: "", candidate_merge_key: "ada" }), null);
  assert.equal(normalizeCandidateLiveSignal({ ...validSignal, source_url: "http://github.com/ada/repo" }), null);
  assert.equal(normalizeCandidateLiveSignal({ ...validSignal, candidate_merge_key: "" }), null);
  assert.equal(normalizeCandidateLiveSignal({ ...validSignal, observed_at: "" }), null);
  assert.equal(normalizeCandidateLiveSignal({ ...validSignal, summary: "" }), null);
  assert.equal(normalizeCandidateLiveSignal({ ...validSignal, expires_at: "" }), null);
});

test("canonicalizes HTTPS evidence URLs and rejects URLs with credentials", () => {
  const normalized = normalizeCandidateLiveSignal({
    ...validSignal,
    source_url: "https://github.com/ada/repo?utm_source=newsletter&tab=readme#overview",
  });

  assert.equal(normalized.source_url, "https://github.com/ada/repo?tab=readme");
  assert.equal(normalizeCandidateLiveSignal({
    ...validSignal,
    source_url: "https://token@github.com/ada/repo",
  }), null);
});

test("skips malformed batch rows without merging matching evidence across projects", () => {
  const rows = buildCandidateLiveSignalUpsertRows([
    null,
    "not-a-signal",
    validSignal,
    { ...validSignal, project_id: "project-2" },
  ]);

  assert.equal(normalizeCandidateLiveSignal(null), null);
  assert.equal(isCandidateLiveSignalActive(null), false);
  assert.equal(rows.length, 2);
});

test("attaches only fresh persisted signals through an existing stable candidate merge key", () => {
  const candidates = [{
    candidate_id: "linkedin:linkedin.com/in/ada",
    merge_keys: ["linkedin:linkedin.com/in/ada", "person:ada-lovelace:example-ai"],
  }];

  const rows = attachActiveCandidateLiveSignals({
    candidates,
    signals: [
      { ...validSignal, candidate_merge_key: "linkedin:linkedin.com/in/ada" },
      {
        ...validSignal,
        candidate_merge_key: "person:ada-lovelace:example-ai",
        source_url: "https://github.com/ada/fresh-update",
        summary: "Published a fresh GitHub update.",
        content_hash: "hash-fresh",
      },
      {
        ...validSignal,
        source_url: "https://github.com/ada/expired-update",
        expires_at: "2026-07-29T10:00:00.000Z",
        content_hash: "hash-expired",
      },
    ],
    now: "2026-07-30T12:00:00.000Z",
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].live_signals.length, 2);
  assert.deepEqual(rows[0].live_signals.map((signal) => signal.source_url), [
    "https://github.com/ada/repo",
    "https://github.com/ada/fresh-update",
  ]);
  assert.equal(rows[0].live_signals.every((signal) => signal.expires_at > "2026-07-30T12:00:00.000Z"), true);
});

test("deployment migration replaces the legacy evidence key with a scoped unique constraint", () => {
  const migration = readFileSync("migrations/20260730010000_scope_candidate_live_signal_key.sql", "utf8");

  assert.match(migration, /drop constraint if exists candidate_live_signals_evidence_key_unique/i);
  assert.match(migration, /drop index if exists public\.candidate_live_signals_evidence_key_unique/i);
  assert.match(migration, /unique \(user_id, project_id, provider, candidate_merge_key, source_url, content_hash\)/i);
  assert.match(migration, /to_regclass\('public\.candidate_live_signals'\)/i);
});
