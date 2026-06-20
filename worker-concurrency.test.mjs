import test from "node:test";
import assert from "node:assert/strict";

import { fillWorkerPool, normalizeWorkerConcurrency } from "./worker/pool.mjs";

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

test("worker pool starts up to three jobs at once", async () => {
  const activeJobs = new Set();
  const jobs = [{ id: "job-1" }, { id: "job-2" }, { id: "job-3" }, { id: "job-4" }];
  const started = [];
  const blockers = [];

  const count = await fillWorkerPool({
    activeJobs,
    maxConcurrentJobs: 3,
    claimNext: async () => jobs.shift() ?? null,
    runJob: async (job) => {
      started.push(job.id);
      const blocker = deferred();
      blockers.push(blocker);
      return blocker.promise;
    },
  });
  await Promise.resolve();

  assert.equal(count, 3);
  assert.deepEqual(started, ["job-1", "job-2", "job-3"]);
  assert.equal(activeJobs.size, 3);

  blockers.forEach((blocker) => blocker.resolve());
  await Promise.all([...activeJobs]);
  assert.equal(activeJobs.size, 0);
});

test("worker pool only fills available capacity", async () => {
  const existing = deferred();
  const activeJobs = new Set([existing.promise]);
  const jobs = [{ id: "job-1" }, { id: "job-2" }, { id: "job-3" }];
  const started = [];
  const blockers = [];

  const count = await fillWorkerPool({
    activeJobs,
    maxConcurrentJobs: 3,
    claimNext: async () => jobs.shift() ?? null,
    runJob: async (job) => {
      started.push(job.id);
      const blocker = deferred();
      blockers.push(blocker);
      return blocker.promise;
    },
  });
  await Promise.resolve();

  assert.equal(count, 2);
  assert.deepEqual(started, ["job-1", "job-2"]);
  assert.equal(activeJobs.size, 3);

  blockers.forEach((blocker) => blocker.resolve());
  existing.resolve();
  await Promise.allSettled([...activeJobs]);
  activeJobs.delete(existing.promise);
});

test("worker concurrency defaults to three and does not exceed three", () => {
  assert.equal(normalizeWorkerConcurrency(undefined), 3);
  assert.equal(normalizeWorkerConcurrency("2"), 2);
  assert.equal(normalizeWorkerConcurrency("8"), 3);
  assert.equal(normalizeWorkerConcurrency("0"), 3);
});
