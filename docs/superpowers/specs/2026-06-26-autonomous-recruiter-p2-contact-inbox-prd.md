# Autonomous Recruiter P2 PRD: Contact Resolution And Inbox Action Queue

## 1. Summary

P2 的目标是补齐 autonomous recruiter 从“找到候选人并可控发信”到“持续推进对话”的关键缺口：

- 对 ready / near-ready 候选人做可审计的联系方式解析。
- 把联系方式质量、来源、置信度和可发送状态明确展示给用户。
- 继续沿用 Gmail 发信闭环，但不允许低置信或无来源邮箱进入 send。
- 将 Gmail 回复从简单分类升级为行动队列，让用户少管理 inbox。
- interested 候选人进入可约面 review；ask for details / later / needs human reply 生成下一步草稿。

P2 不改变 SignalHire 的底层原则：不猜邮箱、不伪造候选人证据、不未经批准发送首封外联。更激进的数据能力必须通过带来源和置信度的 provider adapter 接入。

## 2. Goals

- 用户能对选中的候选人点击 `Resolve contact`，看到可用联系方式、估算可发送性和来源。
- 系统能在没有 provider key 时优雅降级：保留现有 internal resume / OpenJobs Mira / PDL-normalized 数据，不阻断候选人研究和草稿。
- 系统能支持一个可插拔联系方式 provider，第一版优先支持按量或低门槛的 work email finder。
- Role Workspace 能清楚表达哪些候选人可发、不可发、需要补联系方式、需要人工复核。
- Inbox Queue 从“分类列表”升级为“下一步动作列表”：reply draft、schedule ask、stop follow-up、follow up later。
- 所有自动分类都展示理由和原始片段，用户可以覆盖或忽略。

## 3. Non-Goals

本阶段不做：

- 恢复 Apollo。
- 未授权邮箱读取。
- 自动发送首封外联。
- 自动发送 follow-up。
- 自动创建 Google Calendar invite。
- ATS 深集成。
- 从 LinkedIn 登录墙抓取数据。
- 对没有来源和置信度的邮箱做 send。
- 按 interested candidates 收费的商业闭环。

## 4. Primary User Stories

### Recruiter

作为 recruiter，我希望对 shortlist 候选人一键补联系方式，并知道哪个邮箱来自哪个 provider、是否可发，这样我不用手动查邮箱，也不会误发低质量地址。

### Founder / Hiring Manager

作为 founder，我希望每天打开 Role Workspace 就看到“谁回复了、下一步做什么、谁可以约面”，而不是自己翻 Gmail thread。

### Agency / Headhunter

作为 agency，我希望把 interested candidates 和证据、邮件上下文一起交付给客户，让客户快速决定是否安排面试。

## 5. Product Scope

### P2.1 Contact Resolution Gateway

范围：

- 新增 `ContactResolutionResult` view model。
- 新增 `web/lib/contact-resolution.mjs` 纯函数层，统一 provider 返回、内部简历、候选人快照和现有 `contact_profile`。
- Contact provider 输出必须包含：
  - `provider`
  - `source`
  - `confidence`
  - `deliverability_status`
  - `last_verified_at`
  - `cost_units`
  - `raw_reference`
- 只对用户显式选择的候选人解析联系方式。
- 低置信邮箱可展示但不可发送。
- 解析失败时保留原因，不覆盖已有可用联系方式。

验收：

- 没有 provider key 时，解析返回 disabled reason，不破坏现有 contact profile。
- provider 返回 email 但缺少 source/confidence 时被丢弃。
- `valid + medium/high confidence` email 进入 sendable。
- `risky/unknown + medium/high confidence` email 进入 reviewable，但 send 前仍显示风险。
- `low confidence` 或 `bounced` email 不可发送。

### P2.2 First Contact Provider Adapter

范围：

- 新增一个 provider adapter 接口：`resolveContact(candidate, options)`。
- 第一版可以先做 server-only adapter shell 和 mocked normalizer，真实 provider key 通过 env 开启。
- 支持候选人输入：
  - name
  - current company
  - company domain
  - LinkedIn URL
  - existing contact profile
- 不把 provider 原始返回直接暴露给 UI；只暴露 normalized contact profile 和 audit metadata。

推荐 provider 策略：

- 第一候选：支持按量/低门槛 work email finder 的 provider。
- 备选：Hunter Email Finder / Verifier。
- 备选：PDL enrichment，作为 profile + email 的第二来源。

验收：

- adapter 未配置时按钮显示 `Provider not connected`。
- adapter 配置后可返回 normalized emails。
- provider 错误不会清空候选人已有内部联系方式。
- 测试覆盖至少一个成功、一个低置信、一个缺少 source/confidence、一个 provider disabled 场景。

### P2.3 Contact Review UX

范围：

- Role Workspace 候选人行增加 `Resolve contact` / `Review contact`。
- 展示：
  - contactability score
  - primary email
  - source
  - confidence
  - deliverability status
  - last verified
  - send eligibility
- send 被禁用时显示具体原因：
  - no email
  - low confidence
  - bounced
  - Gmail not connected
  - thread not approved
- 支持复制邮箱和打开 LinkedIn，但不自动解锁私人数据。

验收：

- 用户能一眼看出候选人是否可外联。
- 不可发送原因在候选人行和 outreach sequence 区一致。
- 移动端不出现横向溢出。

### P2.4 Inbox Action Queue

范围：

- 扩展 `buildInboxQueue` 输出 `next_action`、`action_label`、`priority`、`reply_draft`、`scheduling_prompt`。
- interested：进入 `needs_scheduling`，建议安排面试或转发 hiring manager。
- ask for details：生成包含 role context 的回复草稿。
- later：生成 follow-up reminder，不自动发送。
- not interested / bounced：停止 follow-up。
- out_of_office：生成稍后跟进建议。
- needs human reply：突出原文片段和人工复核 CTA。

验收：

- 每条 inbox item 都有明确下一步动作。
- interested 队列能被 hiring manager 快速阅读。
- not interested / bounced 不再继续 follow-up。
- 自动分类保留分类理由和邮件片段。

### P2.5 Scheduling Handoff

范围：

- 不接 Calendar API。
- 对 interested 候选人生成 scheduling handoff packet：
  - candidate summary
  - strongest evidence
  - risks / unverified claims
  - reply excerpt
  - suggested scheduling message
  - suggested interview questions
- 支持复制或导出 packet。

验收：

- 用户可以把 handoff packet 发给 hiring manager。
- packet 明确区分 verified / unverified。
- 生成内容不声称已经约面。

## 6. Data Objects

### `ContactResolutionResult`

```ts
type ContactResolutionResult = {
  ok: boolean;
  candidate_id: string;
  provider: string;
  status: "resolved" | "disabled" | "not_found" | "error";
  reason: string;
  contact_profile: ContactProfile;
  audit: {
    searched_at: string;
    cost_units: number;
    input_fields: string[];
    raw_reference: string;
  };
};
```

### `InboxActionItem`

```ts
type InboxActionItem = {
  id: string;
  candidate_name: string;
  classification: string;
  classification_reason: string;
  last_message_excerpt: string;
  next_action: "schedule" | "reply" | "follow_up_later" | "stop" | "review";
  action_label: string;
  priority: "high" | "medium" | "low";
  reply_draft: string;
  scheduling_prompt: string;
};
```

## 7. Technical Notes

- 优先复用 `web/lib/contact-profile.mjs` 的邮箱校验和 sendable 规则。
- 第一版先做 view model / metadata，不新增必须迁移的 provider 表。
- 若需要持久化解析结果，优先写回 candidate 的 `contact_profile` 或 outreach thread 的 `contact_profile`。
- Provider key 只能在 server route 使用，不能暴露给 client。
- 外部 provider 调用必须只对用户授权的候选人触发，不做全库批量扫。

## 8. Test Plan

Unit tests：

- `contact-resolution.test.mjs`
  - disabled provider keeps existing contacts
  - missing source/confidence emails are rejected
  - medium/high valid emails become sendable
  - low confidence/bounced emails are not sendable
  - provider error preserves existing contact profile

- `inbox-agent.test.mjs`
  - interested -> schedule action
  - ask for details -> reply action with draft
  - later/out_of_office -> follow_up_later
  - not interested/bounced -> stop
  - needs human reply -> review

Source/API tests：

- provider routes are server-only and do not expose API keys.
- Role Workspace renders contact reason and inbox action labels.
- Gmail send validation still rejects non-sendable contacts.

Verification：

- `node --test contact-profile.test.mjs contact-resolution.test.mjs inbox-agent.test.mjs gmail-outreach.test.mjs api-route-copy.test.mjs`
- `npm --prefix web run build`
- Desktop and mobile Role Workspace screenshot check after UI work.

## 9. Rollout Plan

1. Ship P2.1 pure contact resolution model and tests.
2. Add provider adapter shell and route with disabled-state UX.
3. Add Role Workspace contact review controls.
4. Upgrade Inbox Queue action model and UI copy.
5. Add scheduling handoff packet for interested candidates.
6. Run two independent acceptance agents:
   - Product function agent: checks P2.1-P2.5 scope and API behavior.
   - UX agent: checks role workspace clarity, send-disabled reasons, inbox action readability, desktop/mobile layout.

## 10. Open Decisions

- Which paid contact provider should be first live adapter.
- Whether contact resolution results should be persisted immediately to `shortlist_items.candidate.contact_profile` or only to outreach thread metadata in first release.
- Whether risky deliverability should allow manual send override in P2 or remain blocked until P3.
