# 搜索反馈闭环 V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用户查看候选人结果后，通过低成本选择题反馈本轮精准度和满意度，并用反馈立即优化同一搜索的下一轮搜索。

**Architecture:** 反馈先不进入数据库，V1 在前端收集结构化选择项，再调用 `web/lib/talent-profile.mjs` 的纯函数生成下一轮搜索输入。`ResearchTool` 复用现有 `run(override, { preserveInput: true })` 队列能力，不新增 API。

**Tech Stack:** Next.js Client Component, React state, Node `node:test`, existing SignalHire talent profile helpers.

---

### Task 1: 反馈优化搜索输入纯函数

**Files:**
- Modify: `talent-profile.test.mjs`
- Modify: `web/lib/talent-profile.mjs`
- Modify: `web/lib/talent-profile.d.ts`

- [ ] **Step 1: 写失败测试**

新增测试：`buildFeedbackOptimizedSearchInput` 必须把原始搜索 brief、用户选择题反馈、上一轮候选人摘要和正常 payload 要求写入下一轮搜索输入。

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test talent-profile.test.mjs`
Expected: FAIL with `buildFeedbackOptimizedSearchInput` missing.

- [ ] **Step 3: 最小实现**

在 `web/lib/talent-profile.mjs` 增加结构化反馈归一化和输入生成函数；在 `.d.ts` 增加类型与导出。

- [ ] **Step 4: 运行测试确认通过**

Run: `node --test talent-profile.test.mjs`
Expected: PASS.

### Task 2: 搜索结果页选择题反馈 UI

**Files:**
- Modify: `web/components/ResearchTool.tsx`

- [ ] **Step 1: 接入 helper 和反馈 state**

在 `ResearchTool` 中新增选择题状态，选项包含精准度、满意度、主要问题、下一轮优化方向。

- [ ] **Step 2: 渲染反馈面板**

在搜索结果区、候选人详情前渲染「这轮结果怎么样？」面板，用按钮式单选降低用户输入成本。

- [ ] **Step 3: 一键优化下一轮搜索**

点击「按反馈优化下一轮」时调用 `buildFeedbackOptimizedSearchInput({ result, feedback })`，再执行 `run(optimizedInput, { preserveInput: true })`。

### Task 3: 验证与发布

**Files:**
- Verify only.

- [ ] **Step 1: 单元测试**

Run: `node --test talent-profile.test.mjs`

- [ ] **Step 2: 现有回归测试**

Run: `node --test run-storage.test.mjs`
Run: `node --test job-state.test.mjs`

- [ ] **Step 3: 前端静态检查与构建**

Run: `npx eslint components/ResearchTool.tsx`
Run: `npx tsc --noEmit`
Run: `npm run build`

- [ ] **Step 4: diff 检查**

Run: `git diff --check`
