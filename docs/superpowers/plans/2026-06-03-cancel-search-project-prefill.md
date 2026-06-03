# 停止搜索与项目预填 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 进行中的搜索可以由用户停止；项目页进入“在本项目下搜人”时只预填 brief，不自动开始搜索。

**Architecture:** 队列层新增 `canceled` 状态和取消更新 helper，Web API 暴露 `/api/cancel` 给前端停止 queued/running/retrying 任务。`ResearchTool` 使用 `AbortController` 停止当前请求/轮询，并通知后端取消已入队任务；worker 写进度和最终结果时增加 `status='running'` 条件，避免已取消任务被覆盖成完成。

**Tech Stack:** Next.js App Router API route, React Client Component, Insforge research_runs queue, Node worker, Node `node:test`.

---

### Task 1: 队列取消语义

**Files:**
- Modify: `job-state.test.mjs`
- Modify: `web/lib/job-state.mjs`
- Modify: `web/lib/job-state.d.ts`
- Modify: `worker/job-state.mjs`

- [ ] **Step 1: 写失败测试**

在 `job-state.test.mjs` 中断言 `buildCancelUpdate(now)` 返回 `status: "canceled"`、清空锁、写入用户停止提示，并断言 `describeJobStatus({ status: "canceled" })` 返回用户可读的停止状态。

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test job-state.test.mjs`
Expected: FAIL with missing `buildCancelUpdate`.

- [ ] **Step 3: 最小实现**

在 web/worker 共用的 job-state 模块中增加 `CANCELED` 状态、`buildCancelUpdate` 和 canceled 展示文案。

### Task 2: 后端取消 API 与 worker 防覆盖

**Files:**
- Modify: `web/lib/db.ts`
- Create: `web/app/api/cancel/route.ts`
- Modify: `worker/index.mjs`

- [ ] **Step 1: 新增 `cancelRun`**

`cancelRun(id, userId)` 只允许当前用户取消 `queued/running/retrying` 行，并返回最新 `RunStatus`。

- [ ] **Step 2: 新增 `/api/cancel`**

`POST /api/cancel { id }` 调用 `cancelRun`，成功返回 `{ canceled: true, runId, ...status }`。

- [ ] **Step 3: worker 写库加状态保护**

进度、成功和失败写回都加 `.eq("status", "running")`，避免已取消任务被后续 worker 写回覆盖。

### Task 3: 前端停止按钮与项目预填

**Files:**
- Modify: `web/components/ResearchTool.tsx`
- Create: `web/lib/search-page-state.mjs`
- Create: `web/lib/search-page-state.d.ts`
- Modify: `web/app/app/search/page.tsx`
- Modify: `web/app/app/projects/[id]/page.tsx`
- Test: `search-page-state.test.mjs`

- [ ] **Step 1: 搜索页自动运行 helper**

新增 `shouldAutoRunInitialSearch({ initialInput, projectId })`，项目上下文返回 false，非项目但有 `q` 返回 true。

- [ ] **Step 2: 接入搜索页**

`/app/search` 用 helper 计算 `autoRun`，项目入口带来的 `q` 只预填。

- [ ] **Step 3: 接入停止按钮**

`ResearchTool` 在 loading 状态显示“停止搜索”，点击后 abort 当前 fetch、停止 polling，并调用 `/api/cancel` 取消当前 job。

### Task 4: 验证

- [ ] Run: `node --test job-state.test.mjs`
- [ ] Run: `node --test search-page-state.test.mjs`
- [ ] Run: `node --test run-storage.test.mjs`
- [ ] Run: `node --test talent-profile.test.mjs`
- [ ] Run: `npx eslint components/ResearchTool.tsx app/app/search/page.tsx app/app/projects/[id]/page.tsx app/api/cancel/route.ts`
- [ ] Run: `npx tsc --noEmit`
- [ ] Run: `npm run build`
- [ ] Run: `git diff --check`
