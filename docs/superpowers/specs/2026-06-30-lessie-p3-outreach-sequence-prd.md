# P3 PRD: Outreach Sequence Workspace Upgrade

日期：2026-06-30

## 1. Summary

`Outreach Sequence Workspace Upgrade` 把 SignalHire 的外联能力从单封 evidence-based 草稿，升级为可控的 3-step outreach sequence。

这个阶段学习 Lessie 的 AI 个性化外联，但不采用黑盒自动发送。SignalHire 的原则是：每封外联都要引用候选人的 strongest evidence / outreach angle；首封必须人工批准；follow-up 默认保留为 draft 或 review 状态。

## 2. Product Promise

> Turn evidence-backed candidates into reviewable outreach sequences. SignalHire drafts the first email and follow-ups, but users approve before anything is sent.

中文表达：

> 把带证据的候选人转成可审核外联序列。SignalHire 生成首封和跟进邮件，但发送前必须由用户确认。

## 3. Why This Matters

当前 SignalHire 已有外联草稿、contact profile、Gmail send、批量解析和批准。P3 的重点不是从零开发外联，而是把已有能力组织成更清楚的 sequence workflow：

- 用户知道每个候选人处于哪个外联阶段。
- 用户可以批量批准 ready drafts。
- 用户可以编辑首封和 follow-up。
- 系统能清楚解释为什么不能发。
- follow-up 不会在用户未确认时自动发送。

## 4. Users And Jobs

### Recruiter

Job：对一组候选人批量推进外联，但仍能控制质量。

成功体验：可以筛出 ready candidates，检查 contact provenance，一键批准安全草稿。

### Founder / Hiring Manager

Job：不想写 cold email，但希望外联看起来具体、可信、不像模板。

成功体验：每封邮件都引用候选人的真实证据点。

### Agency / Headhunter

Job：需要为客户持续推进候选人，并记录每个人的触达状态。

成功体验：能看到 drafted / approved / sent / follow-up scheduled / stopped 的状态链路。

## 5. Scope

### In Scope

- 每个 candidate outreach thread 展示 3-step sequence：
  - Step 1: first email
  - Step 2: follow-up 1
  - Step 3: follow-up 2
- 每封邮件展示：
  - subject
  - body
  - evidence refs
  - send mode
- 支持编辑首封和 follow-up。
- 支持 bulk approve ready drafts。
- 支持 skip / stop。
- send eligibility 显示具体禁用原因。
- contact profile provenance 显示：
  - email
  - source
  - confidence
  - deliverability
  - last_verified_at
  - contactability_score
- 首封邮件发送必须用户确认。
- follow-up 默认 `draft_for_review`。
- 支持 role-level setting：`auto_follow_up_only`。
- follow-up 默认间隔为 7 天。
- 为 agency 用户生成客户可见的 outreach activity digest。

### Out Of Scope

- 自动发送首封。
- 默认自动发送 follow-up。
- 新增 Gmail OAuth 能力。
- 新增 Calendar scheduling。
- ATS 集成。
- 新增 contact provider。
- SEO/free tools。

## 6. Core Workflow

### Flow A: Candidate Has No Sendable Contact

1. 候选人在 outreach panel 中出现。
2. 系统显示 no sourced medium/high confidence email。
3. Approve / Send 禁用。
4. 用户可以点击 resolve contact。
5. 如果 provider disabled，显示 provider disabled reason。

### Flow B: Candidate Has Sendable Contact

1. 候选人有 sourced medium/high confidence email。
2. 系统展示 contact provenance。
3. 系统生成 3-step sequence。
4. 用户编辑或直接 approve。
5. 首封进入 approved 状态。
6. 用户手动点击 send，从 Gmail 发出。

### Flow C: Follow-Up

1. 首封发送后，thread 状态变为 sent / follow_up_scheduled。
2. follow-up 1 和 follow-up 2 保持 draft/review。
3. 默认 follow-up 间隔为 7 天。
4. 用户可编辑、skip 或 stop。
5. 如果 role-level setting 开启 `auto_follow_up_only`，系统可以只自动发送已批准过的 follow-up，不允许自动发送首封。
6. 如果未开启 `auto_follow_up_only`，follow-up 仍保持 draft/review。

### Flow D: Stop / Skip

1. 用户点击 skip 或状态改为 stopped。
2. 后续 follow-up 不再推进。
3. 状态保留在 thread 中。

## 7. Sequence Data Model

### `OutreachSequenceMessage`

```ts
type OutreachSequenceMessage = {
  step: 1 | 2 | 3;
  subject: string;
  body: string;
  send_mode: "manual_approval_required" | "draft_for_review";
  evidence_refs: string[];
  delay_days?: number;
};
```

### `RoleOutreachSettings`

```ts
type RoleOutreachSettings = {
  auto_follow_up_only: boolean;
  follow_up_interval_days: 7;
  client_visible_digest: boolean;
};
```

### Sequence Rules

- Step 1:
  - `send_mode = manual_approval_required`
  - must include strongest evidence or outreach angle
  - can be sent only when thread status is `approved`

- Step 2:
  - `send_mode = draft_for_review`
  - references the same role/candidate context
  - `delay_days = 7`
  - can auto-send only if role-level `auto_follow_up_only` is enabled and the follow-up was approved

- Step 3:
  - `send_mode = draft_for_review`
  - final polite close
  - `delay_days = 7`
  - can auto-send only if role-level `auto_follow_up_only` is enabled and the follow-up was approved

## 8. Send Eligibility

Send eligibility depends on `ContactProfile`:

Required:

- at least one email
- email has source
- confidence is medium or high
- deliverability is not bounced
- Gmail connected
- thread approved

Disabled reasons:

- `no_email`
- `low_confidence_email`
- `bounced_email`
- `missing_sendable_email`
- `gmail_not_connected`
- `thread_not_approved`
- `contact_requires_review`

UI must show the reason in plain language.

## 9. Contact Provenance UI

Each candidate row must show:

- primary email
- source badge
- confidence badge
- deliverability badge
- last verified date if present
- contactability score
- review-only warning for non-primary emails
- copy email action
- LinkedIn link if present

Rules:

- Low confidence email can be visible but not sendable.
- Bounced email can be visible but not sendable.
- Missing source email cannot be sendable.
- Contact profile must not imply that candidate is qualified; it only describes reachability.

## 10. Bulk Actions

### Resolve Missing Contacts

- Calls bulk contact resolution.
- Cost guard remains max 10 provider lookups per run.
- Existing sendable contacts are skipped.
- Recent not-found candidates are skipped.

### Resolve & Approve Ready

- Resolves missing contacts where allowed.
- Selects candidates with sendable contacts.
- Approves drafts.
- Does not send email.

### Approve Ready Drafts

- Approves only drafted threads with sendable contacts.
- Does not resolve contacts.
- Does not send email.

### Retry Failed Approvals

- Re-approves failed approval items.
- Does not resolve contacts.
- Does not send email.

### Auto Follow-Up Only

- Role-level setting name: `auto_follow_up_only`。
- Default: `false`。
- When enabled:
  - 首封仍必须人工批准并手动发送。
  - follow-up 只能对 already approved sequence message 自动发送。
  - follow-up 默认间隔 7 天。
  - stopped / replied / bounced / not interested 候选人不再自动跟进。
  - 每次自动 follow-up 必须写入 activity log。

## 11. UI Requirements

### Panel Header

Title:

- EN: `Gmail Outreach Sequence`
- ZH: `Gmail 外联序列`

Supporting copy must state:

- first send goes through Gmail after approval
- follow-ups stay drafted for review
- if `auto_follow_up_only` is enabled, only approved follow-ups can be sent automatically after 7 days

### Candidate Card

Each card displays:

- candidate name
- subject
- thread status
- contact provenance
- editable first email subject/body
- sequence preview with three steps
- next follow-up date
- disabled send reason
- contact risk warning
- save edits
- approve
- send
- skip

### Role-Level Settings

Role Workspace 增加 outreach settings 区块：

- toggle：`Auto follow-up only`
- interval display：`7 days`
- explanation：首封不会自动发送；只有已批准的 follow-up 可以在 7 天后自动发送。

### Agency Client Digest

Agency 用户需要客户可见的 outreach activity digest：

- digest 是只读视图或可复制文本。
- 不展示内部 provider raw reference、成本、失败堆栈或 private notes。
- 展示内容：
  - role name
  - candidate name
  - outreach status
  - last activity
  - next follow-up date
  - evidence angle summary
  - contact provenance summary
  - reply summary if available
- digest 必须明确说明 pending / draft / sent / stopped 状态。

### Accessibility

- Buttons have stable sizes.
- Long emails wrap.
- Textareas are resizable vertically.
- Disabled state is visually and semantically clear.
- Mobile layout does not create horizontal overflow.

## 12. Metrics

- `draft_to_approved_rate`
- `approved_to_sent_rate`
- `send_disabled_reason_count`
- `bulk_resolve_cost_units`
- `follow_up_draft_edit_rate`
- `skip_rate`
- `auto_follow_up_enabled_rate`
- `auto_follow_up_sent_count`
- `agency_digest_generated_count`

## 13. Acceptance Criteria

- Every outreach thread can show a 3-step sequence.
- Step 1 is manual approval required.
- Step 2 and Step 3 are draft-for-review by default.
- Role-level `auto_follow_up_only` setting exists and defaults to false.
- Follow-up default interval is 7 days.
- Auto follow-up only applies to approved follow-up messages, never first email.
- Agency client-visible digest can be generated without exposing internal raw provider data.
- Approve / Send disabled when no sendable sourced email exists.
- Send disabled reason is visible before user action.
- Contact provenance is visible before approve/send.
- Bulk approve does not send emails.
- Retry failed approvals does not resolve contacts or send emails.
- Follow-up copy references evidence or outreach angle.

## 14. Test Plan

- Unit test：`buildEvidenceDrivenOutreachSequence` returns 3 steps.
- Unit test：Step 1 `send_mode` is `manual_approval_required`。
- Unit test：Step 2/3 `send_mode` is `draft_for_review`。
- Unit test：follow-up `delay_days` defaults to 7。
- Unit test：role setting `auto_follow_up_only` defaults to false and never applies to first email。
- Unit test：agency digest excludes provider raw references and private notes。
- Existing tests：`outreach-readiness.test.mjs` remains passing.
- Existing tests：`contact-resolution*.test.mjs` remains passing.
- Source guard：page copy says follow-ups remain drafted for review.
- Build：`npm --prefix web run build`。

## 15. Confirmed Decisions

- 允许 role-level setting 开启 `auto_follow_up_only`。
- follow-up 默认间隔是 7 天。
- 需要为 agency 用户生成客户可见的 outreach activity digest。
