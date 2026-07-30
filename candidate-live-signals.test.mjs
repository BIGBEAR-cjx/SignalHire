import test from "node:test";
import assert from "node:assert/strict";
import {
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
