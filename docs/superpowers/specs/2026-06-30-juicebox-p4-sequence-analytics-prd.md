# P4 PRD: Sequence Analytics

日期：2026-06-30

## 1. Summary

Sequence Analytics 把当前 Gmail Outreach Sequence 从“可控发送和跟进”升级为“可运营的外联效果面板”。

第一版不追大规模群发，而是围绕每个 role 展示 open / reply / bounce / interested / stopped / step performance，帮助 recruiter 判断外联质量和下一轮 sourcing 方向。

## 2. Product Promise

> See how each outreach sequence performs by role, step, and candidate status, without turning SignalHire into a bulk email tool.

中文表达：

> 按岗位、步骤和候选人状态查看外联表现，但不把 SignalHire 做成群发工具。

## 3. Users And Jobs

### Recruiter

Job：知道哪些外联有效，哪些候选人需要跟进或停止。

成功体验：看到 reply / bounce / interested，并能调整 sequence。

### Agency / Headhunter

Job：给客户汇报外联活动和转化。

成功体验：digest 自动包含关键活动数字和状态。

## 4. Scope

### In Scope

- Role-level sequence analytics panel。
- 指标：
  - drafted
  - approved
  - sent
  - opened if available
  - replied
  - interested
  - bounced
  - stopped
  - due follow-up
- Step performance：
  - step 1 sent/replied
  - step 2 draft/replied
  - step 3 draft/replied
- Candidate status rollup。
- Client digest 增加 analytics summary。
- 不依赖 open tracking pixel；如果 Gmail 不提供 open，则显示 unavailable。

### Out Of Scope

- 邮件打开追踪 pixel。
- 大规模 sender rotation。
- deliverability warming。
- A/B testing。
- 自动优化文案。

## 5. Data Contract

```ts
type SequenceAnalyticsView = {
  role_id: string;
  summary: {
    drafted: number;
    approved: number;
    sent: number;
    replied: number;
    interested: number;
    bounced: number;
    stopped: number;
    due_follow_up: number;
    open_tracking_available: boolean;
  };
  step_performance: Array<{
    step: 1 | 2 | 3;
    drafted: number;
    sent: number;
    replied: number;
    interested: number;
    bounced: number;
  }>;
  next_actions: string[];
};
```

## 6. UX Requirements

- Analytics 放在 Gmail Outreach Sequence 和 Inbox Agent 之间。
- 不显示 “0% open rate” 误导用户；open unavailable 时明确写 unavailable。
- next actions 使用操作语言：review due drafts、stop bounced、schedule interested。
- Client digest 只展示聚合数字，不展示私密备注。

## 7. Guardrails

- 不制造 open tracking。
- 不自动改变发送规则。
- 不鼓励大规模群发。
- 不以 reply rate 取代 candidate evidence quality。

## 8. Acceptance Criteria

- Role Workspace 显示 sequence analytics summary。
- Step performance 能从 outreach threads 推导。
- Client digest 包含聚合 summary。
- 没有 Gmail open 数据时显示 unavailable。
