import test from "node:test";
import assert from "node:assert/strict";
import { runOpenJobsProviderSearch } from "./web/lib/openjobs-route.mjs";

test("OpenJobs route core rejects unauthenticated requests before tenant lookup", async () => {
  let lookedUp = false;
  const result = await runOpenJobsProviderSearch({
    body: { project_id: "p1" },
    user: null,
    getProject: async () => {
      lookedUp = true;
      return null;
    },
    messages: { loginRequired: "login required" },
  });

  assert.equal(result.status, 401);
  assert.equal(result.body.error, "login required");
  assert.equal(lookedUp, false);
});

test("OpenJobs route core validates project ownership before provider search", async () => {
  let searchCalled = false;
  const result = await runOpenJobsProviderSearch({
    body: { project_id: "other-project" },
    user: { id: "u1" },
    getProject: async (userId, projectId) => {
      assert.equal(userId, "u1");
      assert.equal(projectId, "other-project");
      return null;
    },
    searchMiraPeople: async () => {
      searchCalled = true;
      return [];
    },
    messages: { projectNotFound: "not found" },
  });

  assert.equal(result.status, 404);
  assert.equal(result.body.error, "not found");
  assert.equal(searchCalled, false);
});

test("OpenJobs route core saves project candidates as needs_evidence", async () => {
  const saved = [];
  const result = await runOpenJobsProviderSearch({
    body: { project_id: "p1", brief: "AI growth lead", limit: 1 },
    user: { id: "u1" },
    getProject: async () => ({ id: "p1", name: "Fallback role", brief: "Fallback brief" }),
    searchMiraPeople: async (input) => {
      assert.deepEqual(input, { text: "AI growth lead", size: 1 });
      return [{ provider_id: "mira-1", name: "Ada Lovelace" }];
    },
    toShortlistCandidates: (rows) => rows.map((row) => ({ ...row, provider: "openjobs_mira" })),
    addItem: async (input) => {
      saved.push(input);
      return "shortlist-1";
    },
  });

  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { ok: true, provider: "openjobs_mira", found: 1, saved: 1 });
  assert.equal(saved.length, 1);
  assert.equal(saved[0].userId, "u1");
  assert.equal(saved[0].projectId, "p1");
  assert.equal(saved[0].status, "needs_evidence");
  assert.equal(saved[0].dedupKey, "u1:project:p1:openjobs:mira-1");
});

test("OpenJobs route core returns ok false without throwing provider errors", async () => {
  const result = await runOpenJobsProviderSearch({
    body: { project_id: "p1" },
    user: { id: "u1" },
    getProject: async () => ({ id: "p1", name: "AI role", brief: "" }),
    searchMiraPeople: async () => {
      throw new Error("invalid api key");
    },
    toShortlistCandidates: () => [],
    addItem: async () => {
      throw new Error("should not save");
    },
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.ok, false);
  assert.equal(result.body.provider, "openjobs_mira");
  assert.equal(result.body.error, "invalid api key");
  assert.equal(result.body.saved, 0);
});
