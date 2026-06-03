import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_MAX_ATTEMPTS,
  STALE_AFTER_MS,
  buildCancelUpdate,
  buildRetryUpdate,
  buildRunFailureUpdate,
  buildRunStartUpdate,
  describeJobStatus,
  isStaleRunningJob,
} from "./web/lib/job-state.mjs";

const now = new Date("2026-05-28T10:00:00.000Z");

test("detects stale running jobs from updated_at or locked_at", () => {
  assert.equal(
    isStaleRunningJob(
      { status: "running", updated_at: "2026-05-28T09:49:59.000Z" },
      now,
    ),
    true,
  );
  assert.equal(
    isStaleRunningJob(
      { status: "running", locked_at: "2026-05-28T09:55:00.000Z" },
      now,
    ),
    false,
  );
  assert.equal(
    isStaleRunningJob(
      { status: "queued", updated_at: "2026-05-28T09:00:00.000Z" },
      now,
    ),
    false,
  );
});

test("starts a job with running metadata", () => {
  assert.deepEqual(buildRunStartUpdate(now), {
    status: "running",
    locked_at: now.toISOString(),
    started_at: now.toISOString(),
    updated_at: now.toISOString(),
    last_error: null,
  });
});

test("retries failed runs until max attempts, then records final error", () => {
  assert.deepEqual(
    buildRunFailureUpdate({
      attemptCount: 1,
      maxAttempts: 3,
      error: new Error("network closed"),
      now,
    }),
    {
      status: "retrying",
      attempt_count: 1,
      max_attempts: 3,
      last_error: "network closed",
      error: null,
      locked_at: null,
      updated_at: now.toISOString(),
    },
  );
  assert.deepEqual(
    buildRunFailureUpdate({
      attemptCount: 3,
      maxAttempts: 3,
      error: new Error("still broken"),
      now,
    }),
    {
      status: "error",
      attempt_count: 3,
      max_attempts: 3,
      last_error: "still broken",
      error: "still broken",
      locked_at: null,
      updated_at: now.toISOString(),
    },
  );
});

test("manual retry resets an errored job to queued", () => {
  assert.deepEqual(buildRetryUpdate(now), {
    status: "queued",
    attempt_count: 0,
    max_attempts: DEFAULT_MAX_ATTEMPTS,
    error: null,
    last_error: null,
    locked_at: null,
    started_at: null,
    finished_at: null,
    progress: null,
    updated_at: now.toISOString(),
  });
});

test("canceling a run records a stopped terminal status", () => {
  assert.deepEqual(buildCancelUpdate(now), {
    status: "canceled",
    error: "用户已停止搜索",
    last_error: "用户已停止搜索",
    locked_at: null,
    finished_at: now.toISOString(),
    updated_at: now.toISOString(),
  });
});

test("describes user-visible status for polling UI", () => {
  assert.deepEqual(describeJobStatus({ status: "queued" }), {
    phase: "queued",
    label: "已进入研究队列",
    detail: "等待 worker 认领任务。",
    canRetry: false,
  });
  assert.deepEqual(describeJobStatus({ status: "running" }), {
    phase: "running",
    label: "正在全网搜索/抓取/核验",
    detail: "Worker 正在搜索网页、抓取页面并交叉核验证据。",
    canRetry: false,
  });
  assert.deepEqual(
    describeJobStatus({
      status: "retrying",
      attempt_count: 2,
      max_attempts: 3,
      last_error: "HTTP 502",
    }),
    {
      phase: "retrying",
      label: "正在重试",
      detail: "上次失败: HTTP 502。正在准备第 3/3 次尝试。",
      canRetry: false,
    },
  );
  assert.deepEqual(
    describeJobStatus({ status: "error", error: "模型输出不是干净 JSON" }),
    {
      phase: "error",
      label: "研究失败",
      detail: "模型输出不是干净 JSON",
      canRetry: true,
    },
  );
  assert.deepEqual(
    describeJobStatus({ status: "canceled" }),
    {
      phase: "canceled",
      label: "搜索已停止",
      detail: "你已停止本次搜索。可以调整条件后重新搜索。",
      canRetry: false,
    },
  );
});

test("documents the stale threshold used by web and worker", () => {
  assert.equal(STALE_AFTER_MS, 10 * 60 * 1000);
});
