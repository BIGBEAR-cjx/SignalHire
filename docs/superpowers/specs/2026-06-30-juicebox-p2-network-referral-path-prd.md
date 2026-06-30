# P2 PRD: Network / Referral Path

日期：2026-06-30

## 1. Summary

Network / Referral Path 是 SignalHire 对标 Juicebox Network Sourcing 的轻量版本。目标不是做完整社交图，而是让招聘团队上传可控的人脉种子，生成 warm intro path、shared context 和 intro snippet。

第一版只处理用户授权或手动上传的数据：员工网络 CSV、历史候选人、公司/学校/项目关系、LinkedIn URL seed。SignalHire 不抓登录态 LinkedIn，不承诺完整一度/二度关系图。

## 2. Product Promise

> Find warm intro paths from user-provided network seeds, then explain why the connection may work and draft a concise intro request.

中文表达：

> 基于用户提供的人脉种子，找出候选人的潜在引荐路径，并生成可解释的共同关系和引荐请求文案。

## 3. Users And Jobs

### Founder / Hiring Manager

Job：想知道候选人是否能通过自己或团队认识的人 warm intro。

成功体验：看到候选人与团队之间的共同公司、学校、项目或联系人线索。

### Recruiter

Job：想把冷外联优先替换成 warm intro，提高回复率。

成功体验：候选人卡片显示 referral path 和 intro snippet。

### Agency / Headhunter

Job：有客户/顾问网络，希望更快找到可信入口。

成功体验：客户可见报告能显示“可尝试引荐路径”，但不暴露敏感内部备注。

## 4. Scope

### In Scope

- 支持上传 network seed CSV。
- 支持手动录入 LinkedIn URL seed。
- 支持从历史候选人中提取 company / school / project overlaps。
- 新增 `ReferralPathView` view model。
- 候选人卡片展示：
  - warm path type
  - shared context
  - introducer candidate
  - confidence
  - intro snippet
- Smart Report 中展示 client-safe referral summary。

### Out Of Scope

- LinkedIn 登录态抓取。
- 自动读取员工 LinkedIn connections。
- 完整社交图谱。
- 自动发送 intro request。
- 推断私人关系强度。
- 展示未经授权的员工联系人详情。

## 5. Data Contract

```ts
type ReferralPathView = {
  candidate_id: string;
  candidate_name: string;
  paths: Array<{
    path_type: "shared_company" | "shared_school" | "shared_project" | "known_candidate" | "manual_seed";
    shared_context: string;
    introducer_label: string;
    confidence: "high" | "medium" | "low";
    intro_snippet: string;
    client_safe: boolean;
  }>;
};
```

## 6. UX Requirements

- Referral path 只能作为优先级信号，不替代 evidence quality。
- 候选人详情显示最多 2 条 referral path。
- Intro snippet 必须短，适合复制到 Slack/Email。
- Client report 只展示 `client_safe = true` 的摘要。
- 没有 path 时不展示空卡片。

## 7. Guardrails

- 不伪造认识关系。
- 不说 “knows” 除非用户数据明确表达。
- 默认用 “may have shared context”。
- 不展示员工私人邮箱/手机号。
- 不抓 LinkedIn 登录墙。

## 8. Acceptance Criteria

- 上传/输入 network seed 后能生成候选人级 referral path。
- 相同公司/学校/项目能生成 shared context。
- Intro snippet 不包含未经授权的私人联系方式。
- Client-safe report 不暴露 private notes。
