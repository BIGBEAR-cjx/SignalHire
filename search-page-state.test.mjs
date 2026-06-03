import test from "node:test";
import assert from "node:assert/strict";

import { shouldAutoRunInitialSearch } from "./web/lib/search-page-state.mjs";

test("auto-runs direct search links that provide an initial query", () => {
  assert.equal(shouldAutoRunInitialSearch({ initialInput: "Find LLM infra engineers" }), true);
});

test("does not auto-run project-scoped search links even when brief is prefilled", () => {
  assert.equal(
    shouldAutoRunInitialSearch({
      initialInput: "Find LLM infra engineers",
      projectId: "project-1",
    }),
    false,
  );
});

test("does not auto-run without a non-empty query", () => {
  assert.equal(shouldAutoRunInitialSearch({ initialInput: "   " }), false);
});
