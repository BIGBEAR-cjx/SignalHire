# 搜索研究闭环 V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把现有搜人流程整理成可感知、可反馈、可迭代的一轮研究闭环：用户手动启动搜索，搜索中看到系统正在搜什么，搜索后用选择题反馈质量，并在下一轮搜索前看到优化预览。

**Architecture:** 新增 `web/lib/research-loop.mjs` 放置可测试的展示逻辑，React 组件只负责渲染和触发动作。搜索过程继续复用现有 `feed`、`live`、`jobStatus`、`buildResearchProgressView` 和 `run()`，不改 worker 事件协议，不新增反馈数据表。

**Tech Stack:** Next.js Client Components, existing SignalHire UI components, Node `node:test`, existing i18n dictionary.

---

### Task 1: 研究闭环展示 helper

**Files:**
- Create: `research-loop.test.mjs`
- Create: `web/lib/research-loop.mjs`
- Create: `web/lib/research-loop.d.ts`

- [ ] **Step 1: 写失败测试**

测试 `buildResearchLoopView()` 在中文和英文模式下能返回当前阶段、阶段说明、统计文字、最近搜索内容和来源覆盖。

验证点：
- search event 显示为正在搜索关键词。
- fetch event 显示为正在读取来源。
- GitHub、论文、公司页、公开网页来源能从 feed 中推断为覆盖 chips。
- 没有事件时返回“正在生成搜索计划”一类的空状态。

- [ ] **Step 2: 实现 helper**

实现纯函数：
- `buildResearchLoopView({ feed, live, jobStatus, locale })`
- `inferResearchCoverage(feed)`
- `extractRecentResearchItems(feed)`

保持输出结构稳定，方便组件和测试复用。

### Task 2: 反馈优化预览 helper

**Files:**
- Modify: `research-loop.test.mjs`
- Modify: `web/lib/research-loop.mjs`
- Modify: `web/lib/research-loop.d.ts`

- [ ] **Step 1: 写失败测试**

测试 `buildFeedbackOptimizationPreview()` 根据选择题反馈返回下一轮优化预览，并在缺少精准度或满意度时返回不可运行状态。

验证点：
- 缺少核心反馈时 `canRun` 为 `false`。
- “不精准”会生成收紧画像或补充证据的预览。
- “不满意”会生成扩展来源或调整候选类型的预览。
- 中文和英文文案都可返回。

- [ ] **Step 2: 实现 helper**

实现纯函数：
- `buildFeedbackOptimizationPreview({ feedback, locale })`

它只负责展示下一轮会如何优化，不负责生成真正的搜索输入。真正的下一轮输入继续由 `buildFeedbackOptimizedSearchInput()` 生成。

### Task 3: 搜索过程面板 UI

**Files:**
- Modify: `web/components/research-workspace.tsx`
- Modify: `web/components/ResearchTool.tsx`
- Modify: `web/lib/i18n.mjs`

- [ ] **Step 1: 接入研究闭环 helper**

用 `buildResearchLoopView()` 替换 `ResearchTool` 中加载态对 `buildResearchProgressView()` 的直接消费，保留现有停止搜索行为。

- [ ] **Step 2: 增强加载态 UI**

新增或扩展 `ResearchProcessPanel`，展示：
- 当前阶段和说明。
- 搜索/抓取统计。
- 最近搜索词和抓取链接，允许换行。
- 来源覆盖 chips。
- 停止搜索按钮。

- [ ] **Step 3: 补齐双语文案**

新增固定文案必须写入 `web/lib/i18n.mjs`，中文为默认阅读体验，英文模式返回英文。

### Task 4: 反馈优化预览 UI

**Files:**
- Modify: `web/components/research-workspace.tsx`
- Modify: `web/components/ResearchTool.tsx`
- Modify: `web/lib/i18n.mjs`

- [ ] **Step 1: 抽出反馈面板组件**

把 `ResearchTool` 中现有选择题反馈区整理成 `FeedbackOptimizationPreview`，保留当前 `SEARCH_FEEDBACK_GROUPS` 和 `runFeedbackOptimizedSearch()`。

- [ ] **Step 2: 显示优化预览**

在用户选择核心反馈后显示下一轮优化说明。未选择精准度和满意度前，主按钮保持不可运行，并显示明确提示。

- [ ] **Step 3: 验证下一轮搜索仍复用现有流程**

点击“按反馈优化下一轮搜索”后仍调用 `buildFeedbackOptimizedSearchInput()` 和 `run(..., { preserveInput: true })`。

### Task 5: 项目页下一步建议

**Files:**
- Modify: `research-loop.test.mjs`
- Modify: `web/lib/research-loop.mjs`
- Modify: `web/lib/research-loop.d.ts`
- Modify: `web/app/app/projects/[id]/page.tsx`
- Modify: `web/lib/i18n.mjs`

- [ ] **Step 1: 写失败测试**

测试 `buildProjectNextSteps()` 在候选池为空、有候选人、有历史搜索、存在筛选时返回不同建议。

- [ ] **Step 2: 实现 helper**

实现纯函数：
- `buildProjectNextSteps({ candidateCount, runCount, hasFilter, locale })`

- [ ] **Step 3: 接入项目详情页**

在项目详情页候选池/历史搜索附近展示轻量下一步建议，不重构整个项目页布局。

### Task 6: 验证

- [ ] Run: `node --test research-loop.test.mjs`
- [ ] Run: `node --test research-progress.test.mjs`
- [ ] Run: `node --test talent-profile.test.mjs`
- [ ] Run: `node --test i18n.test.mjs`
- [ ] Run: `npm run build`
- [ ] Run: `git diff --check`

### Acceptance Criteria

- 搜索运行中能看到明确阶段、搜索内容、抓取内容和来源覆盖。
- 搜索运行中仍能停止搜索。
- 反馈区通过选择题收集精准度、满意度、主要问题和下一轮方向。
- 用户发起下一轮搜索前能看到优化预览。
- 项目详情页能根据当前项目状态给出下一步建议。
- 新增固定文案支持中文和英文。
- 不新增导出功能、反馈表、候选人详情路由或 worker 事件协议。
- 单元测试和构建通过。
