# P1 PRD: SignalHire Smart Report

日期：2026-06-30

## 1. Summary

SignalHire Smart Report 把现有公开 evidence report 升级为面向 hiring manager / 客户的候选人交付报告。

它不是展示搜索过程，也不是普通分享页；它回答交付方最关心的 6 个问题：

1. 这次岗位交付覆盖了哪些候选人？
2. 哪些候选人证据最强、最值得先看？
3. 候选人的 source mix 是否足够可信？
4. 主要风险、未核实点、证据缺口是什么？
5. 当前外联和回复状态如何？
6. 下一步应该推进、补证据、外联还是安排面试？

## 2. Product Promise

> Turn a SignalHire role into a client-ready hiring report: source mix, evidence summary, risks, outreach status, interview-ready candidates, and next actions in one shareable view.

中文表达：

> 把一个岗位的候选人、证据、风险、外联状态和下一步建议整理成可直接交付给 hiring manager 或客户的报告。

## 3. Users And Jobs

### Hiring Manager

Job：不想看搜索过程，只想知道“谁值得看、为什么、风险在哪里、下一步做什么”。

成功体验：打开报告后 2 分钟内能决定先看哪几个人。

### Agency / Headhunter

Job：需要把阶段性招聘进展交付给客户，并证明不是随便给名单。

成功体验：报告同时显示证据、外联状态和下一步，客户能看到工作进度。

### Recruiter

Job：从日常工作台生成可分享交付物，减少手写周报和候选人摘要。

成功体验：不用复制多个模块内容，报告自动聚合 shortlist、source mix、风险和 outreach。

## 4. Scope

### In Scope

- 新增 Smart Report view model。
- 在 public report 页面展示 Smart Report 区块。
- 报告包含：
  - role / brief summary
  - source mix
  - candidate delivery summary
  - top candidates
  - evidence summary
  - risk / unverified claims
  - outreach status summary
  - interview-ready / needs scheduling summary
  - recommended next actions
- 复用现有 `ShortlistDeliveryReport`、`SourceMixSummaryView`、candidate evidence 字段。
- 不暴露 provider raw reference、成本、private notes、错误堆栈。
- 空状态可读：没有外联数据时明确写 “No outreach activity yet”。

### Out Of Scope

- PDF 导出。
- 独立客户门户。
- 自定义 branding。
- 新增数据库表。
- ATS/CRM 深集成。
- 展示内部执行 trace、prompt、provider cost。

## 5. Data Contract

### `SmartReportView`

```ts
type SmartReportView = {
  title: string;
  brief_summary: string;
  metrics: {
    candidates: number;
    strong_evidence: number;
    ready_for_outreach: number;
    needs_scheduling: number;
  };
  source_mix: Array<{
    source_type: string;
    label: string;
    count: number;
    tooltip: string;
  }>;
  top_candidates: Array<{
    name: string;
    role: string;
    match_score: number;
    evidence_quality: "high" | "medium" | "low" | string;
    evidence_summary: string;
    primary_risk: string;
    outreach_status: string;
    next_action: string;
  }>;
  risks: string[];
  next_actions: string[];
};
```

## 6. UX Requirements

- Smart Report 必须出现在 public report 的候选人详情之前。
- 顶部必须是交付摘要，不是搜索过程。
- Top candidates 最多展示 5 个，避免报告过长。
- 每个候选人必须同时有 fit/evidence 和 risk/next action。
- Source mix 使用可读 label 和 tooltip，不显示 raw snake_case 作为主文案。
- 没有 outreach 状态时显示 “Not started”，不能空白。
- 中文和英文页面都要可读。

## 7. Guardrails

- 不把未核实候选人称为 recommended / interview-ready。
- 不把 people API / OpenJobs profile lead 当强证据。
- 不显示内部 provider 成本。
- 不显示 private notes。
- 不显示后台 job error stack。
- 不自动生成夸张结论，如 “95% match” 或 “guaranteed response”。

## 8. Acceptance Criteria

- Public report 页面展示 Smart Report 标题。
- Smart Report 展示 source mix、risk、next actions。
- 没有外联数据时仍能渲染报告。
- 单来源或低证据候选人的 next action 指向补证据，而不是直接外联。
- 有测试覆盖 view model 和 report page wiring。

## 9. Metrics

- `smart_report_viewed`
- `smart_report_top_candidate_click`
- `smart_report_copy_summary`
- `client_report_shared`
- `next_action_followed`
