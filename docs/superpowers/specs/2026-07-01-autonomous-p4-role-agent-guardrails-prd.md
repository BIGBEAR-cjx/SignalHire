# P4 PRD: Autonomous Recruiter Role Agent Guardrails

日期：2026-07-01

## 1. Summary

`Role Agent Guardrails` 是 Autonomous Recruiter P4 的谨慎版本。目标不是立刻全自动招聘，而是把 role agent 的目标、限制、活动、下一步和自动化边界产品化，让用户知道系统可以做什么、不能做什么、为什么还需要批准。

## 2. Product Promise

> Keep the role moving with visible guardrails: capacity goals, next tasks, approval mode, and blocked automation explained.

中文表达：

> 让岗位持续推进，但每个自动化边界都可见、可控、可解释。

## 3. Users And Jobs

### Founder / Hiring Manager

Job：不想管理每个候选人，但必须知道系统下一步准备做什么。

成功体验：看到 role 是否健康、需要自己批准什么、何时能交付候选人。

### Recruiter

Job：让系统补候选人、整理外联状态和生成 digest，但保留发送控制。

成功体验：能暂停/恢复、看 capacity pressure、知道哪些动作被守护栏拦住。

## 4. Scope

### In Scope

- Role Agent view model:
  - status：draft / active / paused / review_required
  - approval mode：manual all / auto follow-up only
  - capacity goal summary
  - current counts：contacted, replied, interested, interview-ready
  - next recommended tasks
  - blocked automation reasons
  - activity log entries
- Guardrail rules:
  - first email always manual
  - follow-up review draft eligibility only when role setting enables it and message was approved
  - stopped / replied / bounced candidates stop automation
  - low evidence / missing contact stays review-only
- Compact Role Workspace panel.

### Out Of Scope

- `auto_high_confidence` enablement.
- Auto-send first email.
- New scheduler or background worker.
- New DB schema.
- New people API or contact provider.

## 5. Guardrail Rules

| Rule | Behavior |
| --- | --- |
| First email | Always manual approval and manual send. |
| Follow-up | May enter reviewed follow-up draft flow only if `auto_follow_up_only=true`, message step is 2 or 3, and message was already approved. |
| Contact quality | Missing, low-confidence, bounced, or source-less emails block send. |
| Evidence quality | Low evidence or needs verification is review-only. |
| Stop states | replied, bounced, stopped, not interested disable future automation. |
| High-confidence auto-send | Explicitly blocked in this phase. |

## 6. UX Requirements

- Panel title should be `Role Agent Guardrails`.
- The first line should communicate status and approval mode.
- Show counters in compact tiles, not a dense table.
- Show blocked automation as a short list.
- Include copy that clarifies SignalHire is running a controlled workflow, not a black-box sender.

## 7. Acceptance Criteria

- Default approval mode is manual-first.
- UI includes `First email manual` or localized equivalent.
- Tests prove `auto_high_confidence` is normalized to a blocked/manual mode.
- Guardrail view returns next tasks from sequence analytics and evidence gaps.
- No route automatically sends an email from this feature.

## 8. Metrics

- Roles with guardrail panel viewed.
- Roles paused/resumed in future phases.
- Approval actions completed.
- Blocked automation reasons by category.
- Interested candidates produced per role.
