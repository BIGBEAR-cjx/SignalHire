# 实时搜索感知与平台语言 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 搜索进行中展示可读的实时搜索轨迹，并让搜索/核验结果默认按中文输出。

**Architecture:** 新增 `web/lib/research-progress.mjs` 作为纯展示 helper，`ResearchTool` 只消费格式化后的当前动作、统计和时间线。Prompt 层在 web 和 worker 两份 MiroMind 客户端中增加平台语言规则，默认中文，后续可把语言参数接入设置。

**Tech Stack:** Next.js Client Component, MiroMind reasoning steps, Node `node:test`.

---

### Task 1: 实时研究轨迹 helper

**Files:**
- Create: `research-progress.test.mjs`
- Create: `web/lib/research-progress.mjs`
- Create: `web/lib/research-progress.d.ts`
- Modify: `web/components/ResearchTool.tsx`

- [ ] **Step 1: 写失败测试**

断言搜索事件显示为“搜索关键词”，抓取事件显示为“读取来源”，当前动作取最后一条事件，内容完整保留。

- [ ] **Step 2: 实现 helper 并接入 UI**

加载态显示当前动作、搜索/抓取计数、完整时间线。

### Task 2: 平台语言 prompt

**Files:**
- Modify: `talent-profile.test.mjs`
- Modify: `web/lib/miro.ts`
- Modify: `worker/lib.mjs`

- [ ] **Step 1: 写失败测试**

断言 web 和 worker 的 search/verify prompt 都包含 `OUTPUT LANGUAGE`、默认中文、用户可读字段语言规则和禁止直接粘贴来源段落。

- [ ] **Step 2: 实现 prompt 语言规则**

增加默认平台语言参数，JSON keys 和 enums 保持原样。

### Task 3: 验证

- [ ] Run: `node --test research-progress.test.mjs`
- [ ] Run: `node --test talent-profile.test.mjs`
- [ ] Run: `node --test job-state.test.mjs`
- [ ] Run: `node --test run-storage.test.mjs`
- [ ] Run: `npx eslint components/ResearchTool.tsx`
- [ ] Run: `npx tsc --noEmit`
- [ ] Run: `npm run build`
- [ ] Run: `node --check worker/lib.mjs`
- [ ] Run: `git diff --check`
