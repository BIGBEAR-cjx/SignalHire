import test from "node:test";
import assert from "node:assert/strict";
import {
  runBackgroundInboxSync,
  selectBackgroundInboxSyncProjects,
} from "./web/lib/inbox-background-sync.mjs";

test("selects only projects with active Gmail outreach threads", () => {
  const projects = selectBackgroundInboxSyncProjects({
    outreachThreads: [
      { id: "t1", user_id: "u1", project_id: "p1", gmail_thread_id: "g1", status: "sent" },
      { id: "t2", user_id: "u1", project_id: "p1", gmail_thread_id: "g2", status: "follow_up_later" },
      { id: "t3", user_id: "u2", project_id: "p2", gmail_thread_id: "g3", status: "bounced" },
      { id: "t4", user_id: "u3", project_id: "p3", gmail_thread_id: "", status: "sent" },
      { id: "t5", user_id: "u4", project_id: null, gmail_thread_id: "g5", status: "sent" },
      { id: "t6", user_id: "u5", project_id: "p5", gmail_thread_id: "g6", status: "hired" },
      { id: "t7", user_id: "u6", project_id: "p6", gmail_thread_id: "g7", status: "follow_up_due" },
    ],
    maxProjects: 10,
    maxThreadsPerProject: 20,
  });

  assert.deepEqual(projects.map((project) => [project.userId, project.projectId, project.threadCount]), [
    ["u1", "p1", 2],
    ["u6", "p6", 1],
  ]);
});

test("background inbox sync respects project and thread limits", async () => {
  const synced = [];
  const result = await runBackgroundInboxSync({
    projects: [
      { userId: "u1", projectId: "p1", threadCount: 3 },
      { userId: "u2", projectId: "p2", threadCount: 2 },
      { userId: "u3", projectId: "p3", threadCount: 1 },
    ],
    maxProjects: 2,
    maxThreadsPerProject: 5,
    now: new Date("2026-06-26T10:00:00.000Z"),
    syncProject: async (project) => {
      synced.push(project);
      return { ok: true, scanned: project.maxThreads, synced: 1, errors: [], skipped_reason: "" };
    },
  });

  assert.deepEqual(synced.map((project) => [project.userId, project.projectId, project.maxThreads]), [
    ["u1", "p1", 5],
    ["u2", "p2", 5],
  ]);
  assert.equal(result.ok, true);
  assert.equal(result.projects_scanned, 2);
  assert.equal(result.threads_scanned, 10);
  assert.equal(result.replies_synced, 2);
  assert.equal(result.ran_at, "2026-06-26T10:00:00.000Z");
});

test("background inbox sync keeps going when one project fails", async () => {
  const result = await runBackgroundInboxSync({
    projects: [
      { userId: "u1", projectId: "p1", threadCount: 1 },
      { userId: "u2", projectId: "p2", threadCount: 1 },
    ],
    now: new Date("2026-06-26T10:00:00.000Z"),
    syncProject: async (project) => {
      if (project.projectId === "p1") throw new Error("gmail_reconnect_required");
      return { ok: true, scanned: 4, synced: 2, errors: [], skipped_reason: "" };
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.projects_scanned, 2);
  assert.equal(result.threads_scanned, 4);
  assert.equal(result.replies_synced, 2);
  assert.deepEqual(result.errors, [{ user_id: "u1", project_id: "p1", error: "gmail_reconnect_required" }]);
});

test("background inbox sync aggregates skipped project reasons", async () => {
  const result = await runBackgroundInboxSync({
    projects: [
      { userId: "u1", projectId: "p1", threadCount: 1 },
      { userId: "u2", projectId: "p2", threadCount: 1 },
    ],
    now: new Date("2026-06-26T10:00:00.000Z"),
    syncProject: async (project) => ({
      ok: project.projectId !== "p1",
      scanned: project.projectId === "p1" ? 0 : 2,
      synced: project.projectId === "p1" ? 0 : 1,
      errors: [],
      skipped_reason: project.projectId === "p1" ? "gmail_not_connected" : "",
    }),
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.skipped, [{ user_id: "u1", project_id: "p1", reason: "gmail_not_connected" }]);
  assert.equal(result.threads_scanned, 2);
  assert.equal(result.replies_synced, 1);
});

test("background inbox sync marks summary not ok when project returns errors", async () => {
  const result = await runBackgroundInboxSync({
    projects: [
      { userId: "u1", projectId: "p1", threadCount: 1 },
      { userId: "u2", projectId: "p2", threadCount: 1 },
    ],
    now: new Date("2026-06-26T10:00:00.000Z"),
    syncProject: async (project) => ({
      ok: project.projectId !== "p1",
      scanned: 1,
      synced: 0,
      skipped_reason: "",
      errors: project.projectId === "p1" ? [{ error: "gmail_reconnect_required" }] : [],
    }),
  });

  assert.equal(result.ok, false);
  assert.deepEqual(result.errors, [{ user_id: "u1", project_id: "p1", error: "gmail_reconnect_required" }]);
});

test("background inbox sync surfaces candidate query errors instead of empty success", async () => {
  const result = await runBackgroundInboxSync({
    projectError: "inbox_sync_project_query_failed",
    now: new Date("2026-06-26T10:00:00.000Z"),
  });

  assert.equal(result.ok, false);
  assert.equal(result.projects_scanned, 0);
  assert.deepEqual(result.errors, [{ user_id: "", project_id: "", error: "inbox_sync_project_query_failed" }]);
});
