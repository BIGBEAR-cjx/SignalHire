# Agent Execution Layer PRD

## 1. 背景

DINQ 的执行记录显示，它的搜索体验不只是结果页，而是一条可感知的 sourcing 执行链路：先解释搜索策略，再并行调用多渠道工具，过程中提交候选人，最后按候选人群做交付总结。SignalHire 已经有 evidence-first 的候选人报告、Search Result Workspace、Research Log、open evidence precheck 和 candidate profile cache，但这些能力还没有被组织成用户能理解的“执行层”。

本 PRD 的目标是补齐 Agent Execution Layer，让 SignalHire 在不牺牲证据审计的前提下，学习 DINQ 的执行感和交付感。

## 2. 产品目标

- 用户启动搜索后，能看到系统准备按哪些渠道和候选人群搜索。
- 搜索完成后，结果能解释“哪些来源贡献了候选人、哪些候选人是本轮提交、哪些群体最值得优先看”。
- Search Result Workspace 不只展示候选人，也展示执行 telemetry、candidate submission rows 和 delivery clusters。
- 保留 SignalHire 的 evidence-first 原则：低证据候选人不能被包装成强推荐。

## 3. 用户角色

- Recruiter：需要知道本轮搜索是否覆盖了足够来源，以及候选人是否可推进。
- 创始人 / Hiring Manager：需要快速理解搜索结果的市场分布和优先候选人。
- 猎头：需要把搜索结果包装成可交付、可解释的 shortlist。

## 4. MVP 范围

包含：

- `search_strategy`
  - planned channels
  - query variants
  - target segments
  - evidence priorities
- `execution_trace`
  - source / tool name
  - query
  - status
  - duration when available
  - candidate / evidence counts when available
- `candidate_submission_events`
  - candidate row id
  - candidate name
  - source
  - match score
  - evidence quality
  - independent source count
  - submission reason
- `delivery_clusters`
  - cluster name
  - candidate indices
  - rationale
  - next action
- Search Result Workspace 展示：
  - execution telemetry
  - delivery clusters
  - submitted candidate count
  - execution trace preview

不包含：

- 不接入新的真实搜索工具。
- 不新增真实邮件获取、扣点或支付。
- 不新增复杂多工具调度平台。
- 不把 Search Result Workspace 改成纯聊天界面。
- 不把 LinkedIn-only 或单一来源候选人标成强证据。

## 5. 数据方案

第一版不新增数据库表，避免迁移阻塞。执行层数据写在 `research_runs.progress` 和完成后的 `research_runs.result.agent_execution`。

建议结构：

```ts
type AgentExecutionLayer = {
  search_strategy: {
    summary: string;
    channels: Array<{
      key: string;
      label: string;
      coverage_group: string;
      source_types: string[];
      query_variants: string[];
      reason: string;
    }>;
    target_segments: Array<{
      key: string;
      label: string;
      reason: string;
    }>;
    evidence_priorities: string[];
  };
  execution_trace: Array<{
    trace_id: string;
    tool: string;
    source_type: string;
    coverage_group: string;
    query: string;
    status: "planned" | "running" | "completed" | "partial" | "failed";
    candidates_found: number;
    evidence_found: number;
    duration_ms: number;
    note: string;
  }>;
  candidate_submission_events: Array<{
    row_id: string;
    candidate_index: number;
    name: string;
    role: string;
    source: string;
    match_score: number;
    evidence_quality: "high" | "medium" | "low";
    independent_sources: number;
    reason: string;
    status: "submitted";
  }>;
  delivery_clusters: Array<{
    key: string;
    label: string;
    candidate_indices: number[];
    rationale: string;
    next_action: string;
  }>;
  telemetry: {
    duration_ms: number;
    search_count: number;
    fetch_count: number;
    tool_count: number;
    submitted_count: number;
    source_mix: Array<{ source_type: string; count: number }>;
  };
};
```

## 6. 核心流程

1. 用户提交招聘需求。
2. API 入队时生成 deterministic `search_strategy`，写入 queued progress。
3. Worker 认领任务后，把策略放入 prompt context 和 progress。
4. Worker 搜索过程中持续更新 `execution_trace` 的搜索/抓取事件。
5. Worker 完成模型结果解析后，基于候选人和证据审计生成 `candidate_submission_events` 和 `delivery_clusters`。
6. Worker 将 `agent_execution` 写入最终 result。
7. 前端 Search Result Workspace 读取 `agent_execution`，展示执行 telemetry、候选人提交数、delivery clusters 和 trace preview。

## 7. 验收标准

- 新搜索入队时，`progress.agent_execution.search_strategy` 存在并包含至少 4 个渠道。
- 完成后的 search result 包含 `agent_execution.execution_trace`、`candidate_submission_events`、`delivery_clusters` 和 `telemetry`。
- Search Result Workspace 顶部展示 submitted candidate count、trace/tool count 和 source mix。
- 候选人列表能看到 candidate submission 状态，而不是只有静态 shortlist 卡片。
- delivery clusters 至少按 high confidence / needs verification / adjacent pool / lower confidence 分组生成。
- 单一来源或低证据候选人仍然归入 needs verification 或 lower confidence，不被强行放入 high confidence。
- 新增纯函数有自动化测试覆盖。
- worker 仍能在没有新字段或旧结果上正常运行。
- 独立 agent 从 PRD、数据契约、UI 展示和回归风险四个角度完成验收。

## 8. 成功指标

- 用户能在搜索完成页理解这轮搜索“怎么搜、搜到谁、按什么群体交付、下一步做什么”。
- Research Log 不再只是底层日志，而是能解释执行策略。
- SignalHire 形成“DINQ 式执行感 + evidence-first 审计”的差异化体验。
