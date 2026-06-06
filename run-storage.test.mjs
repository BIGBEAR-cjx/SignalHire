import test from "node:test";
import assert from "node:assert/strict";
import { buildRunStorageFields } from "./web/lib/db.ts";

test("bounds long search text before writing research_runs rows", () => {
  const longQuery = "核心产品开发，负责 OkayJob 平台全栈功能迭代，从用户端到管理后台，用 AI 工具链重构开发流程。".repeat(20);
  const fields = buildRunStorageFields({
    kind: "search",
    flatKey: longQuery.toLowerCase(),
    queryText: longQuery,
    label: longQuery,
  });

  assert.ok(fields.cacheKey.length <= 240);
  assert.ok(fields.flatKey.length <= 220);
  assert.ok(fields.queryText.length <= 240);
  assert.ok(fields.label.length <= 80);
  assert.match(fields.flatKey, /[a-f0-9]{16}$/);
  assert.equal(fields.queuedProgress.original_query, longQuery);
  assert.equal(fields.summary, "研究中…");
});

test("keeps distinct hashes for different long run keys", () => {
  const a = buildRunStorageFields({
    kind: "search",
    flatKey: "ai infra ".repeat(80) + "alpha",
    queryText: "alpha",
    label: "alpha",
  });
  const b = buildRunStorageFields({
    kind: "search",
    flatKey: "ai infra ".repeat(80) + "beta",
    queryText: "beta",
    label: "beta",
  });

  assert.notEqual(a.cacheKey, b.cacheKey);
  assert.notEqual(a.flatKey, b.flatKey);
});

test("builds localized queued run summaries from platform language", () => {
  assert.equal(
    buildRunStorageFields({
      kind: "search",
      flatKey: "ai infra",
      queryText: "ai infra",
      label: "ai infra",
      platformLanguage: "English",
    }).summary,
    "Research in progress…",
  );
  assert.equal(
    buildRunStorageFields({
      kind: "search",
      flatKey: "ai infra",
      queryText: "ai infra",
      label: "ai infra",
      platformLanguage: "Chinese (Simplified)",
    }).summary,
    "研究中…",
  );
});
