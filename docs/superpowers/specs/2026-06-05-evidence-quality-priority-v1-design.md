# 证据可信度优先级 V1 设计

## 目标

把 SignalHire 的证据能力从“候选人详情里的一块信息”前移成项目和结果层的决策入口。HR 和猎头打开候选名单时，应先看到哪些候选人证据强、哪些需要补证据、哪些存在红旗或矛盾，再决定审阅、补搜或推进外联。

## 用户问题

当前结果已经包含候选人对比、证据审计、来源覆盖和补搜建议，但这些信息分散在多个面板中。用户容易先看到候选名单，再逐个点开细节，才发现某些人证据弱或风险高。对于招聘决策，这个顺序不够高效。

第二阶段要把“可信度优先级”变成一个可扫描的中间层：

- 哪些候选人可以优先看。
- 哪些候选人需要补搜。
- 哪些候选人有矛盾或身份风险。
- 下一步应该补哪类来源。

## 当前基础

代码中已有这些可复用能力：

- `buildCandidateEvidenceAudit()`：候选人级证据摘要，包含独立信源、来源类型、已验证/未验证/矛盾数量、单源声称、身份风险、时效说明和交叉验证摘要。
- `buildCandidateComparisonRows()`：候选人对比数据，包含 match score、evidence score、evidence quality、coverage gaps 和 risk summary。
- `buildEvidenceCoverage()`：按研究、实践、工作经历、公开表达计算来源覆盖。
- `buildCoverageBackfillPlan()`：生成缺口补搜任务。
- 项目页已有候选池和下一步建议。
- 搜索结果页已有反馈闭环和补搜入口。

## 范围

### 1. 可信度优先级 helper

新增一个纯函数，把候选人和证据审计结果整理成可排序的优先级列表。

输出字段：

- `name`
- `role`
- `match_score`
- `evidence_quality`
- `independent_sources`
- `verified_count`
- `unverified_count`
- `contradicted_count`
- `risk_count`
- `priority`
- `priority_label`
- `priority_reason`
- `recommended_action`

优先级规则第一版保持可解释：

- `ready_to_review`：匹配高、证据质量高、矛盾少。
- `needs_backfill`：匹配可能高，但独立信源少、未验证多或覆盖缺口明显。
- `risk_review`：存在矛盾、身份风险或明显红旗。

### 2. 搜索结果页“可信度优先级”面板

在候选人比较和候选名单之前增加一个轻量面板：

- 顶部展示三类数量：可优先审阅、需要补证据、风险复核。
- 下方展示最多 6 位候选人的优先级列表。
- 每行展示候选人、证据质量、独立信源数、主要原因和建议动作。
- 点击候选人时打开现有候选人详情，不新增新路由。

### 3. 项目页候选池优先级提示

项目页不重构为完整新工作台，只在下一步建议附近补一个证据优先级摘要：

- 如果项目候选池为空，不显示。
- 如果存在候选人，显示当前筛选候选人的证据优先级分布。
- 提示用户先看 `risk_review` 或 `needs_backfill`，再推进外联。

第一版不从数据库重新计算历史 run 结果，只基于项目候选池里保存的 candidate payload 做轻量派生。

### 4. 双语

新增固定文案全部接入 `web/lib/i18n.mjs`，支持中文和英文。候选人姓名、公司、论文、链接和模型生成摘要保持原文。

## 不做

- 不做导出功能。
- 不新增候选人详情路由。
- 不新增数据库表。
- 不新增人工审核工单。
- 不改 worker 输出协议。
- 不做自动外联。
- 不做复杂排序配置后台。

## 组件设计

### `EvidencePriorityPanel`

职责：把候选名单按证据可信度分组并提示下一步动作。

输入：

- `items`
- `onOpenCandidate`
- `locale`
- `compact`

输出：

- 三个优先级统计。
- 候选人优先级列表。
- 主要风险/补搜原因。
- 建议动作。

### `buildEvidencePriorityView()`

职责：纯函数，给搜索结果和项目候选池共用。

输入：

- `result?: TalentSearchResult`
- `candidates?: unknown[]`
- `locale`

输出：

- `summary`
- `items`
- `empty`

## 验收标准

- 搜索结果页能在候选名单前看到证据可信度优先级。
- 项目页能看到候选池的证据优先级分布。
- 每个优先级都有可解释原因和建议动作。
- 用户可以从优先级列表打开现有候选人详情。
- 新增文案支持中英双语。
- 不新增后端接口、数据库表或 worker 协议。
- 单元测试和构建通过。
