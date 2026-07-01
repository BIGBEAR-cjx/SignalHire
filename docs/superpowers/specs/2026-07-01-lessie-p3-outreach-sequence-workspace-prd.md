# P3 PRD: Lessie Outreach Sequence Workspace

日期：2026-07-01

## 1. Summary

`Outreach Sequence Workspace` 把 SignalHire 已有的 evidence-based outreach draft、Gmail send、follow-up draft 和 sequence analytics 聚合成一个可执行工作台。

这不是大规模群发工具。它的差异化是：每个外联步骤都能解释为什么可以发、引用了什么证据、现在卡在哪里，以及下一步应该由用户还是系统处理。

## 2. Product Promise

> Turn evidence-backed candidates into controlled outreach sequences with clear approval, contact provenance, and next actions.

中文表达：

> 把有证据的候选人推进为可审核、可跟进、可解释的外联序列。

## 3. Users And Jobs

### Recruiter

Job：一次处理多个候选人的首封、跟进和停止状态。

成功体验：看到每个候选人的 sequence step、ready/block reason、证据引用和可批量处理项。

### Hiring Manager / Founder

Job：希望外联具体可信，但不想逐封写邮件。

成功体验：能确认外联不是模板群发，首封仍由人批准。

### Agency

Job：向客户交付持续外联进展，而不是静态 shortlist。

成功体验：可以复制客户可见 digest，说明本周发了什么、谁在等待、谁需要处理。

## 4. Scope

### In Scope

- 候选人级 3-step sequence workflow：
  - Step 1 first email：`manual_approval_required`
  - Step 2 follow-up 1：`draft_for_review`
  - Step 3 follow-up 2：`draft_for_review`
- 每个 step 显示：
  - subject / body preview
  - evidence refs
  - delay days
  - send mode
  - state：`ready` / `blocked` / `sent` / `review`
- 候选人级工作台摘要：
  - current step
  - primary CTA
  - block reason
  - sendability from contact profile
  - evidence reference count
- role-level settings：
  - `auto_follow_up_only`
  - fixed 7-day interval
  - client-visible digest
- bulk approve ready drafts remains approval-only.

### Out Of Scope

- 自动发送首封。
- 默认自动发送 follow-up。
- `auto_high_confidence`。
- 新 Gmail OAuth 能力。
- 新 contact provider。
- 新 DB schema。

## 5. Functional Requirements

1. Build a pure helper that converts outreach queue items into sequence workspace items.
2. Preserve existing sequence messages if a thread already has them.
3. Generate fallback sequence only when stored sequence is missing.
4. Mark first email as manual approval required.
5. Treat no email, low-confidence email, bounced email, and unapproved thread as visible block reasons.
6. Expose next action labels:
   - approve draft
   - send first email
   - review follow-up
   - resolve contact
   - stop sequence
7. Never mark first email as auto-sendable.
8. Show digest and sequence analytics as role-level context, not a replacement for candidate-level review.

## 6. UX Requirements

- Sequence controls must fit in the existing Role Workspace panel without creating a separate landing page.
- Candidate cards should make the current step scannable before the email body.
- Evidence refs should be compact chips, not long paragraphs.
- Disabled send actions must show the concrete reason.
- English and Chinese copy should be direct and action-oriented.

## 7. Acceptance Criteria

- A queue item with no sendable email shows `resolve contact`.
- A drafted item with sendable contact shows `approve draft`.
- An approved step 1 remains manual-send only.
- Follow-up steps can indicate review/auto-follow-up eligibility only when already approved and role setting allows it.
- Tests prove first-email auto-send remains impossible.

## 8. Metrics

- Drafts approved per role.
- First emails sent per role.
- Follow-up drafts due.
- Blocked due to contact quality.
- Replies/interested candidates from existing sequence analytics.
