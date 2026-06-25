# Autonomous Recruiter PRD

## 1. Summary

SignalHire 下一阶段从 `evidence-first hiring workspace` 升级为 `autonomous recruiter`。新目标不是只帮助用户判断候选人，而是帮助用户节省招聘工时、少管理 inbox，并最终拿到 interested / interview-ready candidates。

核心转变：

- 从“找信号和证据”升级为“找人、补联系方式、外联、跟进、识别有意向候选人”。
- 从“候选人研究报告”升级为“招聘执行 agent 的可控结果交付”。
- 从公开 web evidence 优先，扩展到内部简历库、授权 people API、用户提供的 LinkedIn URL、公司/个人公开资料和邮箱线程。
- 保留 SignalHire 的可信优势：所有候选人、联系方式、外联状态和回复判断都必须标注来源、置信度和风险。

本阶段不做公开 skill、免费增长工具、候选人端产品，也不承诺绕过 LinkedIn 或邮箱平台的合规限制。

## 2. Product Promise

用户输入一个 role，SignalHire 自动完成：

1. 理解岗位和目标人群。
2. 从内部简历库、people API、LinkedIn URL、公开 web 和公司线索中扩展候选人。
3. 给候选人补充联系方式和可触达性判断。
4. 生成外联序列，用户确认后发送。
5. 读取并归类候选人回复。
6. 把 interested / interview-ready candidates 推给用户。

建议对外承诺：

> Give SignalHire a role. It sources, enriches, reaches out, follows up, and gives you interview-ready candidates with evidence attached.

中文产品表达：

> 给 SignalHire 一个岗位，它会自动找人、补线索、发外联、跟进回复，并交付带证据的可约面候选人。

## 3. Goals

- 用户可以在一个 role 下设置目标候选人数、搜索边界、外联语气和审批规则。
- 系统可以自动从多数据源生成候选人池，而不是只依赖一次 deep research。
- 每个候选人都有 `source provenance`、联系方式置信度、可触达性和证据摘要。
- 用户可以批准外联序列，系统按节奏发送和跟进。
- 系统可以把 inbox 回复自动分为 interested、not interested、ask for details、later、bounced、out of office、needs human reply。
- 用户最终看到的是 interview-ready pipeline，而不是静态候选人列表。

## 4. Non-Goals

本阶段不做：

- 免费增长工具。
- 公开 skill。
- 候选人端 job seeker 产品。
- ATS 深集成。
- 绕过 LinkedIn 官方限制的抓取承诺。
- 未经用户授权读取邮箱。
- 未经用户确认的全自动首封外联。
- 自动编造邮箱、电话或候选人履历。
- 按 interested candidates 收费的完整商业闭环。

## 5. Users And Jobs

### Founder / Hiring Manager

Job：不想学复杂 sourcing 工具，只想告诉系统要招谁，然后看到可推进候选人。

成功体验：每天看到 role agent 的更新、候选人回复和可约面名单。

### Recruiter

Job：减少重复找人、补信息、发跟进、整理 inbox 的时间。

成功体验：可以控制搜索方向和外联质量，但不用手动维护每个候选人状态。

### Agency / Headhunter

Job：为客户持续交付可审计、可跟进、可面试的候选人。

成功体验：能把 role pipeline 和 evidence-backed interview-ready candidates 作为交付物发给客户。

## 6. Phase Roadmap

### P0: CandidateGraph And Aggressive Sourcing Layer

目标：把 SignalHire 从一次性搜索扩展为多源候选人生成系统。

范围：

- 建立 `CandidateGraph` view model。
- 接入内部简历库导入与检索。
- 支持 Apollo / People Data Labs 等 people API 的 search / enrichment 适配层。
- 支持用户提供 LinkedIn URL、similar profile、公司 URL、个人主页作为种子线索。
- 对每条候选人线索标注来源、更新时间、匹配原因、重复合并依据和证据状态。
- Role Workspace 中展示候选人来源 mix、去重结果、证据缺口和联系方式覆盖。

验收：

- 一个 role 可以同时从内部简历库、people API 和用户提供 URL 生成候选人。
- 重复候选人可以按姓名、公司、LinkedIn URL、邮箱 hash、个人主页合并。
- 每个候选人必须展示来源标签：internal resume、people API、LinkedIn URL seed、public web、manual upload。
- 低证据或来源单一的候选人不得进入 high-confidence/interview-ready。
- 若 API key 未配置，系统仍可降级使用内部简历库和公开 web。

### P1: Contact Unlock And Outreach Sequence

目标：让用户从 shortlist 直接进入可控外联，而不是手动找邮箱和复制话术。

范围：

- 新增 `ContactProfile`：email、phone、LinkedIn URL、source、confidence、last_verified_at、deliverability_status。
- 使用 Apollo enrichment / waterfall enrichment 或 PDL enrichment 补充联系方式。
- 候选人卡片增加 contactability score。
- 为每个候选人生成首封外联和 1-2 封 follow-up 草稿。
- 用户可以批量批准、编辑或跳过外联。
- 第一版默认首封必须用户确认后发送。
- 发送后记录 `OutreachSequence` 状态：drafted、approved、sent、follow_up_scheduled、replied、bounced、stopped。

验收：

- 用户可以在候选人详情看到联系方式来源和置信度。
- 系统不会显示未经来源标注的邮箱。
- 用户批准前不会发送首封邮件。
- 外联草稿会引用候选人的 strongest evidence / outreach angle。
- bounced 或 no-response 候选人会反馈给下一轮 sourcing。

### P2: Inbox Agent And Interested Candidate Queue

目标：减少用户管理 inbox 的时间，把候选人回复转成招聘状态。

范围：

- 接入 Gmail OAuth。
- 只读取 SignalHire 发送的 role-related threads。
- 将回复归类为：
  - interested
  - ask for details
  - later
  - not interested
  - bounced
  - out of office
  - needs human reply
- 为 ask for details / later / needs human reply 生成回复草稿。
- Role Workspace 增加 Inbox Queue 和 Interested Candidate Queue。
- 候选人状态自动更新，但关键回复仍保留人工确认入口。

验收：

- Gmail 未授权时，P2 功能不可用但不影响 sourcing 和 shortlist。
- 系统只处理当前 role 的外联线程。
- interested 候选人会进入 Interview-ready review。
- ask for details 会生成上下文相关回复草稿。
- not interested / bounced 会停止后续 follow-up。
- 每个自动分类都展示分类理由和原始邮件片段。

### P3: Interview Scheduling Assistant

目标：把 interested candidate 推进到可安排面试。

范围：

- 接入 Google Calendar availability。
- 为 interested candidate 生成 2-3 个可选面试时间。
- 生成面试邀请草稿和 hiring manager brief。
- 不自动发送 calendar invite，除非用户开启 role-level approval rule。

验收：

- 用户可以从 interested candidate 一键生成 scheduling draft。
- Interview packet 包含候选人摘要、证据、风险、建议问题和外联上下文。
- scheduling 状态回写 Role Workspace funnel。

### P4: Role Agent Autopilot

目标：让一个 role 持续运转，直到达到候选人容量目标或用户暂停。

范围：

- Role-level capacity：目标 contacted、replied、interested、interview-ready 数量。
- 每日自动补候选人：替换 bounced、not interested、no response。
- 每周 hiring manager digest。
- Agent activity log：展示系统做了什么、为什么做、下一步准备做什么。
- 可配置 approval mode：
  - manual approval for all sends
  - auto-follow-up only
  - auto-send to high-confidence contacts

验收：

- 用户可以暂停、恢复、调整一个 role agent。
- 系统能根据回复和证据缺口自动生成下一轮 sourcing task。
- 自动化动作必须可追踪、可撤销、可解释。

## 7. Core Product Objects

### `RoleAgent`

岗位级 autonomous recruiter。

```ts
type RoleAgent = {
  id: string;
  role_id: string;
  status: "draft" | "active" | "paused" | "completed";
  capacity_goal: {
    contacted: number;
    replied: number;
    interested: number;
    interview_ready: number;
  };
  approval_mode: "manual_all" | "auto_follow_up" | "auto_high_confidence";
  sourcing_rules: string[];
  outreach_rules: string[];
  stop_rules: string[];
};
```

### `CandidateGraph`

多来源候选人合并后的候选人实体。

```ts
type CandidateGraph = {
  candidate_id: string;
  canonical_name: string;
  current_title?: string;
  current_company?: string;
  locations: string[];
  source_nodes: SourceLead[];
  merge_keys: string[];
  evidence_summary: EvidenceSummary;
  contact_profile?: ContactProfile;
  role_fit: {
    score: number;
    must_have_hits: string[];
    gaps: string[];
    risks: string[];
  };
};
```

### `SourceLead`

候选人来源线索。

```ts
type SourceLead = {
  source_type: "internal_resume" | "people_api" | "linkedin_seed" | "public_web" | "manual_upload";
  provider?: "apollo" | "pdl" | "proxycurl" | "internal" | "web";
  source_url?: string;
  captured_at: string;
  confidence: "high" | "medium" | "low";
  extracted_fields: Record<string, unknown>;
};
```

### `ContactProfile`

联系方式和可触达性。

```ts
type ContactProfile = {
  emails: Array<{
    value: string;
    type: "work" | "personal" | "unknown";
    source: string;
    confidence: "high" | "medium" | "low";
    last_verified_at?: string;
    deliverability_status?: "valid" | "risky" | "unknown" | "bounced";
  }>;
  phones: Array<{
    value: string;
    source: string;
    confidence: "high" | "medium" | "low";
  }>;
  linkedin_url?: string;
  contactability_score: number;
};
```

### `OutreachSequence`

外联序列和状态。

```ts
type OutreachSequence = {
  id: string;
  role_id: string;
  candidate_id: string;
  status: "drafted" | "approved" | "sent" | "follow_up_scheduled" | "replied" | "bounced" | "stopped";
  messages: Array<{
    step: number;
    subject: string;
    body: string;
    evidence_hooks: string[];
    scheduled_for?: string;
    sent_at?: string;
  }>;
};
```

### `InboxThread`

邮箱线程理解结果。

```ts
type InboxThread = {
  thread_id: string;
  role_id: string;
  candidate_id: string;
  provider: "gmail";
  classification: "interested" | "ask_for_details" | "later" | "not_interested" | "bounced" | "out_of_office" | "needs_human_reply";
  classification_reason: string;
  last_message_excerpt: string;
  suggested_reply?: string;
};
```

### `InterviewReadyCandidate`

最终交付对象。

```ts
type InterviewReadyCandidate = {
  candidate_id: string;
  role_id: string;
  readiness: "ready" | "needs_reply" | "needs_scheduling" | "needs_human_review";
  interest_signal: string;
  evidence_summary: EvidenceSummary;
  risk_flags: string[];
  recommended_next_step: string;
  hiring_manager_packet_id?: string;
};
```

## 8. Data Source Strategy

### Internal Resume Database

用途：

- 第一批可控候选人来源。
- 可做 embedding search、技能结构化、工作经历抽取、联系方式解析。
- 适合优先落地，因为数据规模小、成本低、合规边界更清晰。

要求：

- 导入时记录文件来源、导入时间、用户/团队 ownership。
- 原始简历和抽取字段分开存储。
- 对邮箱、电话等 PII 设置可见性和来源标签。
- 删除候选人时可删除原始文件和抽取数据。

### Apollo

用途：

- People API Search 用于 net-new people sourcing。
- People Enrichment / Bulk People Enrichment 用于候选人补全。
- Waterfall enrichment 可用于邮箱/电话补充，但要按 webhook 异步结果设计。

产品约束：

- 首版把 Apollo 作为 provider adapter，不把 Apollo 字段泄漏到核心对象。
- 所有联系方式必须显示 provider、confidence、last verified 状态。
- 费用和 credit 消耗需要在 UI 上可解释。

官方依据：

- Apollo People API Search: https://docs.apollo.io/reference/people-api-search
- Apollo People Enrichment: https://docs.apollo.io/reference/people-enrichment
- Apollo Waterfall Enrichment: https://docs.apollo.io/docs/enrich-phone-and-email-using-data-waterfall

### People Data Labs

用途：

- Person Search 用于按工作经历、地点、教育、社交资料等字段找候选人。
- Person Enrichment / Bulk Enrichment 用于补全已知候选人。

产品约束：

- PDL 更适合作为 second source，提高候选人和履历字段覆盖。
- 与 Apollo 结果必须做去重和字段冲突标注。
- 如果 Apollo 与 PDL 信息冲突，显示 conflict，而不是静默覆盖。

官方依据：

- PDL Person Search: https://docs.peopledatalabs.com/docs/person-search-api
- PDL Person Enrichment: https://docs.peopledatalabs.com/docs/person-enrichment-api
- PDL Bulk Enrichment: https://docs.peopledatalabs.com/docs/bulk-enrichment-api

### LinkedIn Data

用途：

- 用户提供 LinkedIn URL 作为 seed。
- people API 返回 LinkedIn URL 时作为 identity / merge key。
- 候选人公开资料可作为 evidence review 的入口。

产品约束：

- LinkedIn 官方 Profile API 受限，需要 LinkedIn 批准开发者并遵守数据限制。
- 第一版不承诺自动批量抓 LinkedIn 登录墙内容。
- 可考虑 Proxycurl / Nubela 等第三方作为可替换 provider，但需要单独做合规、成本和数据质量评估。

官方依据：

- LinkedIn Profile API restriction: https://learn.microsoft.com/en-us/linkedin/shared/integrations/people/profile-api
- LinkedIn API access: https://learn.microsoft.com/en-us/linkedin/shared/authentication/getting-access

### Gmail

用途：

- 发送用户批准的外联。
- 读取 SignalHire 相关线程并分类回复。
- 监听新回复进入 Role Workspace。

产品约束：

- 使用 server-side OAuth flow。
- Scope 最小化：P2 初期优先 `gmail.readonly` + `gmail.send`；需要打标签/停止 follow-up 时再评估 `gmail.modify`。
- 只处理 SignalHire 发送或显式绑定到 role 的线程。

官方依据：

- Gmail OAuth scopes: https://developers.google.com/workspace/gmail/api/auth/scopes
- Gmail server-side authorization: https://developers.google.com/workspace/gmail/api/auth/web-server
- Gmail send: https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/send
- Gmail watch: https://developers.google.com/workspace/gmail/api/reference/rest/v1/users/watch

## 9. Main UX Changes

### Role Workspace

新增 agent-first layout：

1. Role Agent Status
   - active / paused / needs approval / interview-ready available
   - capacity progress
   - next automated action

2. Pipeline Funnel
   - sourced
   - enriched
   - contacted
   - replied
   - interested
   - interview-ready

3. Candidate Pool
   - source mix
   - evidence quality
   - contactability
   - outreach status

4. Approval Queue
   - contacts to unlock
   - outreach drafts to approve
   - replies needing human response

5. Inbox Queue
   - classified replies
   - suggested next actions

6. Interview-ready Delivery
   - candidate packet
   - reply signal
   - suggested schedule action

### Candidate Card

候选人卡片需要从 evidence-only 扩展为 action-ready：

- Fit score
- Evidence quality
- Source provenance
- Contactability score
- Outreach status
- Reply status
- Risk flags
- Next action

### Report Language

旧语言：

- Candidate list
- Evidence-qualified shortlist

新语言：

- Interview-ready pipeline
- Interested candidates
- Candidates ready for outreach
- Needs contact enrichment
- Needs human reply
- Needs verification

## 10. Backend Architecture

建议保留现有 worker/search queue，不一次性重写为复杂 agent runtime。

新增轻量模块：

- `providers/people/*`
  - Apollo adapter
  - PDL adapter
  - LinkedIn/URL seed parser
- `candidate-graph`
  - normalize
  - merge
  - score
  - evidence conflict detection
- `contact-enrichment`
  - provider orchestration
  - confidence and deliverability view model
- `outreach-agent`
  - draft generation
  - approval state
  - scheduled follow-up state
- `inbox-agent`
  - Gmail thread fetch
  - reply classification
  - suggested reply generation

第一版可以先把 provider result 存为 result metadata 或 JSON 字段。只有当查询性能或跨 role 复用成为瓶颈时，再新增独立表。

## 11. Metrics

Activation:

- % roles with agent activated
- time from role creation to first candidate sourced
- time from role creation to first approved outreach

Sourcing:

- candidates sourced per role
- unique candidates after dedupe
- internal DB coverage
- API coverage
- evidence high / medium / low distribution

Outreach:

- contact unlock rate
- valid email rate
- approval rate
- send rate
- bounce rate
- reply rate

Outcome:

- interested rate
- interview-ready count per role
- time to first interested candidate
- human touches per interested candidate

Trust:

- % candidates with source provenance
- % contacts with provider/confidence
- % inbox classifications manually corrected
- low-evidence candidates accidentally promoted to interview-ready

## 12. Acceptance Plan

### Agent A: Product Functionality Acceptance

检查：

- P0-P2 核心流程是否完整实现。
- 内部简历库、people API、LinkedIn URL seed 都能进入同一个 CandidateGraph。
- 候选人去重、来源标签和证据质量正常展示。
- 联系方式补全有来源、置信度和状态。
- 用户批准前不会发送首封外联。
- 外联状态能回写 Role Workspace。
- Gmail 授权后，回复能进入 Inbox Queue 并被分类。
- interested candidate 能进入 Interview-ready Queue。

### Agent B: User Experience Acceptance

检查：

- 用户是否能理解 role agent 当前在做什么、下一步做什么。
- Role Workspace 是否清楚表达 sourced → enriched → contacted → replied → interested → interview-ready。
- 联系方式、外联和 inbox 自动化是否给用户足够控制感。
- 低证据候选人是否被明确标记，而不是被误导性推荐。
- 移动端和桌面端核心流程是否无明显遮挡、溢出或信息断层。
- Hiring manager packet 是否能快速阅读。

### Engineering Verification

- Provider adapter 单元测试。
- CandidateGraph normalize / merge / conflict tests。
- ContactProfile confidence view model tests。
- Outreach approval guard tests。
- Inbox classification fixture tests。
- Role Workspace funnel view model tests。
- Frontend build。
- 关键页面桌面端和移动端浏览器截图。

## 13. Rollout Strategy

### Internal Alpha

范围：

- 只用内部简历库 + 手动上传 LinkedIn URL / profile URL。
- 外联只生成草稿，不发送。
- 验证 CandidateGraph、Role Agent Status 和 pipeline language。

### Private Beta

范围：

- 接入 Apollo 或 PDL 其中一个。
- Gmail OAuth 只对测试账号开放。
- 首封外联必须手动批准。
- 每个 role 限制候选人数和发送量。

### Paid Pilot

范围：

- 增加第二个 people provider。
- 启用 follow-up automation。
- 输出 weekly hiring manager digest。
- 按 role pilot 或 sourcing seat 收费，不先按 outcome 收费。

## 14. Key Open Decisions

1. 第一批 people API 选 Apollo 还是 PDL。
   - Apollo 更适合 search + contact enrichment。
   - PDL 更适合 profile enrichment 和数据字段覆盖。
   - 建议先 Apollo，PDL 作为 second-source adapter。

2. 邮件发送用 Gmail 还是自有 sending domain。
   - Gmail 更符合“少管 inbox”，回复线程天然回到用户邮箱。
   - 自有 sending domain 更利于产品控制，但冷启动 deliverability 风险更高。
   - 建议先 Gmail OAuth。

3. LinkedIn 数据策略。
   - 官方 API 受限，不作为第一版强依赖。
   - 用户提供 URL 和 people API 返回 URL 可作为 identity seed。
   - 第三方 LinkedIn provider 需要单独评估条款、成本和稳定性。

4. 自动化边界。
   - 第一版默认用户批准首封。
   - follow-up 可以更早自动化，因为风险低于首封。
   - auto-send high-confidence 作为 P4 之后的角色级开关。

## 15. Recommended First Build

最小可销售版本建议做：

1. Internal resume DB import + CandidateGraph。
2. Apollo adapter：people search + people enrichment。
3. Role Workspace pipeline funnel。
4. ContactProfile + contactability score。
5. Outreach draft approval queue。
6. Gmail send + thread classification 的窄路径。

暂缓：

- PDL second-source。
- Calendar scheduling。
- 完整 auto-send。
- ATS integration。
- outcome-based pricing。

