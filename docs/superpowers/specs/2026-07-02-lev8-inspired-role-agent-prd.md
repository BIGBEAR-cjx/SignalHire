# PRD: Lev8-inspired Role Agent

日期：2026-07-02

## 1. Summary

`Lev8-inspired Role Agent` 把 SignalHire 从“搜索一次并交付 shortlist”推进到“给一个岗位，持续推进到可约面候选人”的 role agent 工作台。

本 PRD 是总方案 + P0 细化：

- P0-P4 定义完整产品路线。
- P0 写到可以直接进入工程拆解。
- P1-P4 保持产品完整，但不提前绑定过细实现。

核心变化：

- 用户输入岗位后，SignalHire 创建或激活一个持续运行的 `RoleAgent`，而不是只创建一次 search run。
- Role Workspace 首屏显示岗位目标、候选人缺口、联系进度、回复目标和下一步动作。
- 系统把 lead preview、CandidateGraph、ContactProfile、Outreach Sequence、Inbox Agent、Smart Report 组织成一个连续 pipeline。
- 自动化允许进入产品方案，只要它明显减少用户手工操作，并且状态、失败恢复、activity history 对用户可见。

## 2. Product Promise

> Give SignalHire a role. It keeps sourcing, decides who is worth contacting now, prepares contact and outreach, handles replies, and delivers interview-ready candidates.

中文表达：

> 给 SignalHire 一个岗位，它持续找人、判断谁现在值得联系、补联系方式、推进外联、处理回复，并交付可约面候选人。

## 3. Target Users And Jobs

### Founder / Hiring Manager

Job：不想学习复杂 sourcing 工具，只想告诉系统招什么人，然后每天看到岗位是否在推进。

成功体验：打开 Role Workspace 后，能直接看到还差多少候选人、谁需要自己处理、什么时候能拿到可约面候选人。

### Recruiter

Job：减少重复找人、补联系方式、写外联、发跟进、整理 inbox 的时间。

成功体验：系统把下一步动作排好：先看谁值得联系、哪些联系方式可用、哪些草稿可发、哪些回复需要处理。

### Agency / Headhunter

Job：为客户持续交付候选人进展，而不是发静态名单。

成功体验：可以把本周新增、已联系、已回复、可约面、风险和下一步整理成客户可见 report。

## 4. Current Baseline

当前代码和产品文档已经具备以下基础能力：

- `Role-aware sourcing`：从 JD 或自然语言 brief 生成 role category、must-have、nice-to-have、exclusions、source strategy 和 query clusters。
- `Fast Lead Preview`：搜索运行中展示 unverified leads，并标注不能直接外联。
- `CandidateGraph`：合并公开证据、profile leads、LinkedIn URL seed、internal resume/manual upload、contact profile，并展示 source mix、merge keys、readiness。
- `ContactProfile`：记录 email、phone、LinkedIn URL、source、confidence、deliverability、resolution metadata、contactability score。
- `Outreach Sequence Workspace`：支持 3-step sequence、evidence refs、逐步编辑/审核、blocked reasons、Gmail draft/send、follow-up draft、失败重试。
- `Inbox Agent`：分类 interested、ask for details、later、not interested、bounced、out of office、needs human reply，并生成 next action。
- `Scheduling support`：可为 interested candidate 生成 scheduling packet 和 Calendar availability draft。
- `Role Agent controls`：已有 agent status、capacity goals、approval mode、client-visible digest、next tasks、blocked automation reasons。
- `Delivery layer`：Smart Report、referral path、ATS-lite Greenhouse import/export、History facet counts、saved views。

P0 不重建这些模块，而是把它们组织成一个更清晰的 one-prompt role agent 入口和工作台。

## 5. Full Phase Roadmap

### P0: One-prompt Role Agent

目标：用户输入岗位后，不只是运行一次搜索，而是创建或激活一个持续运行的 role agent。

用户结果：

- 一个岗位有清楚的 capacity goals。
- 用户看到 candidate gap、contact gap、reply gap、blocked actions。
- 用户在一个 panel 里看到下一步动作：run sourcing、review preview leads、resolve contacts、approve/send outreach、follow up、review interested candidates。

### P1: Why-now Signal Layer

目标：学习 Lev8 的 live signals，把“现在该联系谁”产品化。

信号来源：

- candidate activity。
- profile freshness。
- 公司招聘动态。
- 技术栈变化。
- 最近内容、项目、GitHub、论文、公开 profile 更新。
- inbox reply / no reply / bounced / interested 状态。

用户结果：

- 候选人和 role agent 都有 `why_now`。
- 系统优先展示现在最值得处理的人，而不是只按 match score 排序。
- `next_best_action` 直接解释为什么现在应该 review、resolve、send、follow up 或 stop。

### P2: Contact + Outreach Autopilot

目标：把联系方式解析、可触达评分、首封/跟进序列、批量准备、Gmail 发送和失败重试合成更短路径。

用户结果：

- 用户可以从 Role Workspace 触发“准备可联系候选人”。
- 系统自动完成 contact resolution、sendability check、sequence draft、ready candidate selection。
- 对符合设置的候选人，系统可以执行自动发送或自动跟进；失败时保留清楚的 retry / review 状态。
- 用户能看到系统做了什么、为什么做、哪些候选人被跳过。

### P3: Inbox-to-Interview Pipeline

目标：Inbox Agent 不只分类回复，还直接把回复推进到 interview-ready queue。

用户结果：

- interested reply 进入 scheduling / interview-ready review。
- ask for details 自动生成补资料回复。
- later / out of office 自动安排后续时机。
- not interested / bounced 自动停止序列并反馈下一轮 sourcing。
- 用户看到的是 today queue 和 interview-ready candidates，而不是邮件列表。

### P4: Client Delivery Loop

目标：Smart Report 升级成持续交付页，适合 recruiter / agency 给 hiring manager 或客户看。

用户结果：

- 报告显示本周新增候选人、已联系、已回复、可约面。
- 报告显示 source mix、证据强弱、风险、联系方式覆盖、下一步。
- 报告能说明为什么这个岗位现在健康或不健康。
- 客户看到的是持续招聘进展，而不是一次性名单。

## 6. P0 Detailed Scope

### P0.1 Role Agent Creation / Activation

用户从 search 或 project 创建岗位时，系统应创建或激活一个 `RoleAgent` view。

P0 使用现有 project / outreach settings 能力，不新增独立 role agent 数据表。`RoleAgent` 是 Role Workspace 中的产品 view，由以下数据合成：

- project basic info。
- current / latest search run。
- `projects.outreach_settings`。
- search tasks。
- lead preview。
- CandidateGraph summary。
- outreach queue / sequence analytics。
- inbox agent items。
- Smart Report summary。

默认设置：

- `agent_status`: `active`。
- `approval_mode`: 沿用现有 settings；没有设置时为 `manual_all`。
- `capacity_goal`: 默认显示为可编辑空目标；用户未设置时不伪造目标。
- `client_visible_digest`: 默认开启。

### P0.2 Role Goals

Role Agent panel 必须展示四类目标和当前进度：

- `contacted`: 已触达候选人数。
- `replied`: 已回复候选人数。
- `interested`: 感兴趣候选人数。
- `interview_ready`: 可约面候选人数。

用户可以在面板里编辑 capacity goals。保存后刷新项目页仍能看到相同目标。

如果用户未设置目标，面板显示“未设置目标”，但仍展示当前 counts 和下一步动作。

### P0.3 Role Health

P0 Role Agent 必须把当前岗位状态总结成可读 health view：

- `candidate_gap`: 是否缺少足够候选人或 preview leads。
- `contact_gap`: 是否缺少可发送联系方式。
- `reply_gap`: 是否已联系但回复不足。
- `interview_gap`: 是否有 interested 但尚未进入 interview-ready。
- `blocked_actions`: 当前阻塞原因，例如 missing contact、low confidence contact、unapproved draft、no preview leads、no active search task、needs human reply。

Health 不需要新评分算法。P0 可以使用现有 counts、source mix、contactability、sequence analytics、inbox classifications 生成状态。

### P0.4 Next Best Actions

Role Agent panel 必须显示一个短的 action list，按优先级最多展示 5 项。

P0 支持以下 action types：

1. `run_sourcing`
   - 条件：没有活跃 search run，且候选人/preview lead 不足。
   - 用户动作：进入搜索或运行项目 search task。

2. `review_preview_leads`
   - 条件：lead preview 有未处理 leads。
   - 用户动作：审阅 preview leads，标记不相关或保留为下一步验证。

3. `resolve_contacts`
   - 条件：有候选人缺少 sendable contact。
   - 用户动作：触发 bulk contact resolution。

4. `approve_or_send_outreach`
   - 条件：有 draft / approved sequence items 可处理。
   - 用户动作：批准草稿、发送首封、或处理失败重试。

5. `follow_up`
   - 条件：有 due follow-up 或 no-reply follow-up draft。
   - 用户动作：保存/发送 follow-up 或开启后续自动化设置。

6. `review_interested_candidates`
   - 条件：Inbox Agent 有 interested / interview-ready / needs scheduling 项。
   - 用户动作：生成 scheduling draft 或把候选人推进 interview-ready review。

每个 action 必须显示：

- action label。
- why this action matters。
- affected count。
- primary CTA。
- blocked reason，如果当前不能执行。

### P0.5 Panel Placement

P0 不新建单独 landing page。Role Agent panel 放在现有 Role Workspace / Project detail 页面靠前位置，优先级高于具体候选人列表。

推荐顺序：

1. Role header。
2. Role Agent panel。
3. Lead Preview / CandidateGraph / Source Mix。
4. Gmail Outreach Sequence。
5. Inbox / Scheduling / Smart Report 相关模块。

### P0.6 Activity History

P0 必须展示最近 activity，不要求新建完整审计表。

Activity 来源可以复用：

- latest search run status。
- candidate submission events。
- outreach thread updates。
- sequence message audit events。
- inbox action state。
- follow-up draft run summary。
- role settings update。

每条 activity 至少显示：

- time。
- action label。
- candidate / role context。
- result or status。

## 7. P0 UX Requirements

- 首屏必须让用户知道这个 role 是 active、paused 还是 needs review。
- Capacity goal 和 current counts 用 compact tiles，不用大表格。
- Next actions 必须比证据细节更靠前。
- `why` 文案要招聘方可理解，例如“缺少可发送联系方式，所以不能推进外联”，不要只显示内部状态码。
- Disabled CTA 必须说明具体原因。
- 自动化设置必须和 activity history 放在同一产品语境里：用户能看到系统下一步准备做什么，以及做完后结果在哪里看。
- 中英文 copy 都要保留直接、行动导向的风格。

## 8. P0 Data And Integration Notes

P0 优先复用现有对象，不新增数据库表：

- `RoleOutreachSettings`：保存 agent status、capacity goals、approval mode、digest preference。
- `LeadPreviewView`：提供 preview lead summary、blocked outreach reason。
- `CandidateGraphView`：提供 source mix、readiness、contact coverage。
- `ContactProfile`：提供 sendability、confidence、deliverability。
- `OutreachSequenceWorkspace`：提供 current step、next action、blocked reasons、evidence refs。
- `InboxAgentView`：提供 classifications、today queue、scheduling packet。
- `SmartReportView`：提供 client-facing summary。

P0 可以新增一个纯 view helper，例如 `buildRoleAgentWorkspaceView`，用于聚合上述对象。该 helper 不负责真实发送、搜索或 contact provider 调用，只输出 UI 所需状态。

建议输出结构：

```ts
type RoleAgentWorkspaceView = {
  status: "active" | "paused" | "review_required";
  goals: {
    contacted: number;
    replied: number;
    interested: number;
    interview_ready: number;
  };
  counts: {
    candidates: number;
    preview_leads: number;
    contacted: number;
    replied: number;
    interested: number;
    interview_ready: number;
  };
  health: {
    candidate_gap: boolean;
    contact_gap: boolean;
    reply_gap: boolean;
    interview_gap: boolean;
    blocked_actions: string[];
  };
  next_actions: Array<{
    type: "run_sourcing" | "review_preview_leads" | "resolve_contacts" | "approve_or_send_outreach" | "follow_up" | "review_interested_candidates";
    label: string;
    reason: string;
    affected_count: number;
    cta: string;
    blocked_reason?: string;
  }>;
  activity: Array<{
    at: string;
    label: string;
    context: string;
    status: string;
  }>;
};
```

该结构是 P0 实现建议，不要求在本 PRD 阶段立即冻结最终 API 名称。

## 9. P0 Acceptance Criteria

- 用户从一个 role/project 进入 Role Workspace 时，可以看到 Role Agent panel。
- Role Agent panel 显示 agent status、capacity goals、current counts 和 health summary。
- 用户可以保存 capacity goals，并在刷新后看到保存后的目标。
- 面板展示最多 5 个 next best actions，且至少覆盖 sourcing、lead review、contact resolution、outreach、follow-up、interested review 中当前适用的动作。
- 每个 disabled / blocked action 都显示用户可理解的原因。
- 有 preview leads 时，面板能提示 review preview leads。
- 有 missing contact 时，面板能提示 resolve contacts。
- 有 drafted / approved outreach thread 时，面板能提示 approve/send outreach。
- 有 interested / needs scheduling inbox item 时，面板能提示 review interested candidates。
- 用户暂停 role agent 后，面板仍展示状态和历史，但不把自动动作展示为正在执行。
- P0 不删除现有 CandidateGraph、Lead Preview、Gmail Outreach Sequence、Inbox Agent、Smart Report 模块，只调整它们在 role agent 语境中的入口和摘要。

## 10. Metrics

P0 核心指标：

- roles with capacity goals configured。
- role agent panel views。
- next action clicks by action type。
- preview leads reviewed。
- contacts resolved from role agent panel。
- outreach drafts approved / sent from role agent path。
- interested candidates reviewed。
- time from role creation to first contacted candidate。
- time from role creation to first interested candidate。

后续阶段指标：

- why-now action conversion rate。
- auto contact + outreach success rate。
- reply classification accuracy。
- follow-up automation recovery rate。
- interview-ready candidates per active role。
- client report views / shares。

## 11. Non-goals And Assumptions

P0 不做：

- 新建完整后台调度系统。
- 重写 search worker。
- 重写 CandidateGraph、ContactProfile、Outreach Sequence、Inbox Agent 或 Smart Report。
- 新增候选人端产品。
- 新增 ATS 深集成。
- 重新设计整个项目页。
- 把 P1-P4 的自动化全部一次性实现。

产品假设：

- P0 的价值在于把现有能力组织成一个持续推进的 role agent，而不是增加更多底层 provider。
- 自动化不再作为原则性禁区；只要能显著降低用户操作成本，并且状态、失败恢复和 activity history 可见，就可以进入后续阶段。
- P0 先让用户理解“系统下一步建议做什么”，P1 再补更强的 `why_now` 信号排序。
- P0 可以继续保留人工审核作为默认体验，但文案和数据结构不应阻止 P2/P3 引入更主动的自动化。
