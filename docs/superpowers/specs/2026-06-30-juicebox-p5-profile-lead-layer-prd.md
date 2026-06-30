# P5 PRD: Profile Lead Layer

日期：2026-06-30

## 1. Summary

Profile Lead Layer 把 OpenJobs/Mira 和未来 people provider 明确产品化为“候选人资料线索层”，而不是数据库搜索或强推荐。

SignalHire 已经在代码中把 OpenJobs/Mira 候选人保存为 low-evidence profile lead。P5 的目标是把这个边界产品化：用户知道这些 profile leads 能快速扩展候选池，但必须经过 public evidence verification 才能推荐或外联。

## 2. Product Promise

> Use profile providers to expand candidate leads quickly, then let SignalHire verify evidence before recommendation or outreach.

中文表达：

> 用资料供应商快速扩展候选线索，再由 SignalHire 补公开证据，完成推荐或外联前的可信核验。

## 3. Users And Jobs

### Recruiter

Job：想快速扩展候选池，但不想把 provider profile 当成可信推荐。

成功体验：能一键拉取 leads，并看到哪些还需 evidence verification。

### Founder / Hiring Manager

Job：希望知道候选人来自公开证据还是资料库线索。

成功体验：候选人卡片清楚标注 profile lead / evidence-backed candidate。

## 4. Scope

### In Scope

- 将 OpenJobs/Mira 文案统一为 Profile Lead Layer。
- Role Workspace 标注 profile leads。
- CandidateGraph source mix 区分 profile lead 与 evidence source。
- Lead Preview / Smart Report 保持 profile lead 的低证据状态。
- 下一步建议明确为 evidence verification。
- Provider disabled 状态可读。

### Out Of Scope

- 新增大型数据库营销页面。
- 承诺 profile 数量。
- 把 provider profile 包装成 verified candidate。
- 自动全量解锁联系方式。
- 新增 provider，除非 ATS-lite 或 network path 需要。

## 5. Data Contract

```ts
type ProfileLeadLayerView = {
  provider: "openjobs_mira" | "people_api";
  enabled: boolean;
  lead_count: number;
  verified_candidate_count: number;
  needs_evidence_count: number;
  copy: {
    title: string;
    explanation: string;
    next_step: string;
  };
};
```

## 6. UX Requirements

- OpenJobs 按钮附近说明 “profile leads only”。
- Candidate card 标注 “Profile lead”。
- Source tooltip 解释 people API 不是强证据。
- Smart Report 中 profile lead 不进入 top evidence candidates，除非后续补证据。

## 7. Guardrails

- 不使用 “database search” 作为主定位。
- 不承诺 provider 数据准确率。
- 不允许 profile lead 直接进入外联。
- 不隐藏 provider 来源。

## 8. Acceptance Criteria

- Role Workspace 文案统一为 Profile Lead Layer。
- OpenJobs/Mira 候选人默认 `overall_evidence_quality = low`。
- Profile lead 的 next action 是 evidence verification。
- 测试覆盖 provider profile lead 文案和低证据状态。
