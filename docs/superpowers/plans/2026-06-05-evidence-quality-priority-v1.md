# 证据可信度优先级 V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在搜索结果页和项目页前置信用度判断，让 HR 和猎头先看到候选人证据强弱、补证据需求和风险复核对象，再进入逐个候选人详情。

**Architecture:** 新增 `web/lib/evidence-priority.mjs` 作为纯派生层，复用 `buildCandidateEvidenceAudit()`、`buildCandidateComparisonRows()` 和候选人 payload，不新增数据库表、不新增接口、不改 worker 协议。React 组件只渲染 helper 输出。

**Tech Stack:** Next.js Client Components, existing SignalHire UI components, Node `node:test`, existing i18n dictionary.

---

### Task 1: 可信度优先级 helper

**Files:**
- Create: `evidence-priority.test.mjs`
- Create: `web/lib/evidence-priority.mjs`
- Create: `web/lib/evidence-priority.d.ts`

- [ ] **Step 1: 写失败测试**

覆盖三类优先级：
- 高匹配、高证据、低风险返回 `ready_to_review`。
- 高匹配但独立信源少、未验证多返回 `needs_backfill`。
- 有矛盾或身份风险返回 `risk_review`。

同时覆盖空候选池和英文 locale。

- [ ] **Step 2: 实现 helper**

实现：
- `buildEvidencePriorityView({ result, candidates, locale })`
- `buildEvidencePriorityItem({ candidate, result, locale })`

输出：
- `summary.ready_to_review`
- `summary.needs_backfill`
- `summary.risk_review`
- `items`

### Task 2: 可信度优先级 UI 组件

**Files:**
- Modify: `web/components/research-workspace.tsx` 或 `web/components/result.tsx`
- Modify: `web/lib/i18n.mjs`

- [ ] **Step 1: 新增组件**

新增 `EvidencePriorityPanel`，展示：
- 三类统计。
- 候选人优先级列表。
- 主要原因。
- 建议动作。

- [ ] **Step 2: 补齐中英双语文案**

新增固定文案全部写入 `web/lib/i18n.mjs`。

### Task 3: 接入搜索结果页

**Files:**
- Modify: `web/components/ResearchTool.tsx`

- [ ] **Step 1: 计算优先级视图**

在 `isTalentSearchResult(result)` 分支中使用 `buildEvidencePriorityView({ result, locale })`。

- [ ] **Step 2: 插入展示位置**

把 `EvidencePriorityPanel` 放在 `CandidateComparisonView` 之后、反馈区和候选名单之前。点击候选人时复用 `setSelectedCandidateIndex()` 打开现有详情。

### Task 4: 接入项目页

**Files:**
- Modify: `web/app/app/projects/[id]/page.tsx`

- [ ] **Step 1: 基于项目候选池计算优先级**

用 `filteredItems.map((item) => item.candidate)` 计算当前筛选候选人的证据优先级。

- [ ] **Step 2: 放在下一步建议或候选人列表上方**

候选池为空时不显示。候选池存在时展示 compact 版本，让用户知道先看风险还是先补证据。

### Task 5: 验证

- [ ] Run: `node --test evidence-priority.test.mjs`
- [ ] Run: `node --test talent-profile.test.mjs`
- [ ] Run: `node --test i18n.test.mjs`
- [ ] Run: `npm run build` in `web/`
- [ ] Run: `git diff --check`

### Acceptance Criteria

- 搜索结果页在候选名单前展示证据可信度优先级。
- 项目页展示候选池证据优先级分布。
- 三类优先级都有可解释原因和建议动作。
- 点击优先级列表候选人能打开现有候选人详情。
- 新增固定文案支持中文和英文。
- 不新增导出、数据库表、后端接口或 worker 协议。
- 测试和构建通过。
