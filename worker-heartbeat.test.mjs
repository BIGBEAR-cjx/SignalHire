import test from "node:test";
import assert from "node:assert/strict";

import { startRunHeartbeat } from "./worker/run-heartbeat.mjs";

test("worker heartbeat periodically refreshes running job updated_at and can be stopped", async () => {
  const updates = [];
  const timers = [];
  let cleared = false;
  const db = {
    from(table) {
      assert.equal(table, "research_runs");
      return {
        update(row) {
          updates.push(row);
          return {
            eq(column, value) {
              updates.push({ eq: [column, value] });
              return this;
            },
            then(resolve) {
              resolve();
            },
          };
        },
      };
    },
  };

  const stop = startRunHeartbeat({
    db,
    table: "research_runs",
    jobId: "job-1",
    intervalMs: 30_000,
    setIntervalImpl(callback, delay) {
      timers.push({ callback, delay });
      return "timer-1";
    },
    clearIntervalImpl(timer) {
      assert.equal(timer, "timer-1");
      cleared = true;
    },
  });

  assert.equal(timers.length, 1);
  assert.equal(timers[0].delay, 30_000);

  timers[0].callback();
  await Promise.resolve();

  assert.equal(typeof updates[0].updated_at, "string");
  assert.deepEqual(updates[1], { eq: ["id", "job-1"] });
  assert.deepEqual(updates[2], { eq: ["status", "running"] });

  stop();
  assert.equal(cleared, true);
});
