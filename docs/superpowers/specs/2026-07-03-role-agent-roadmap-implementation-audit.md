# Role Agent Roadmap Implementation Audit

日期：2026-07-03

更新：2026-07-04

- P1 已从 guardrail-only provider 推进到外部 HTTP live signal provider hook：生产需要配置 `LIVE_SIGNAL_PROVIDER_URL` / `LIVE_SIGNAL_PROVIDER_API_KEY` 后才会真实刷新；未配置时继续写入可恢复 guardrail run manifest。
- P2 已新增后台 `prepare_outreach` RoleAgentRun：会复用 bulk contact resolution，批准可触达草稿，并明确不自动发送首封邮件。
- P3 已新增 persisted two-sided message history events：Inbox action 写回会保留历史消息事件，message history 会合并 Gmail / inbox thread / action notes。
- P4 已新增完整客户门户 workspace：`/client` 展示授权项目列表，`/client/projects/[id]` 展示 Overview、Interview-ready、Weekly archive、Reports、Feedback，并复用 customer account access policy。
- 2026-07-04 已完成发布：commit `f59684d`，production deployment `dpl_56z3vNKtF8tCWFvN8bRYvpPBaSU2` Ready，alias `https://signal-hire-eight.vercel.app`。
- 剩余外部依赖：真实 live signal provider endpoint、可用客户/团队测试账号、能通过 Vercel Security Checkpoint 的登录态浏览器会话。

## 1. Summary

本审计用于回答：Lev8-inspired Role Agent 路线图 P0-P4 目前哪些已经落地，哪些只是产品视图，后续任务还剩什么。

当前状态：

- P0 `One-prompt Role Agent` 已经进入可执行工作台阶段：Role Agent panel、capacity goals、health、next actions、activity history、metrics persistence 和多个直接执行动作已经具备实现与测试覆盖。
- P1 `Why-now Signal Layer` 已经有 candidate-level `why_now`、`next_best_action`、contact timing window、live signal contract、过期信号降权、从 CandidateGraph evidence/profile/company-open-role/tech-stack context 推断 live signals 的第一版 ingestion，以及 stale/expired signal refresh queue、scheduled refresh cron 和 provider guardrail fallback；但还不是完整外部实时信号系统。
- P2 `Contact + Outreach Autopilot` 已经有 Role Agent 入口下的 contact resolution、ready draft approval、follow-up draft、failed send retry、execution log、recovery history、persisted role-agent run manifests、backend RoleAgentRun sourcing/live-signal refresh，以及统一 autopilot workflow preview / run plan；但还不是完整无人值守的端到端后台自动发送编排。
- P3 `Inbox-to-Interview Pipeline` 已经有 interested queue、interview-ready queue、scheduling state、candidate/manager negotiation state、two-sided message history、activity timeline、handoff/calendar/recovery state、slot hold、Google Calendar event create/reschedule/cancel、interview lifecycle writeback、confirmed interview metric 和 Role Agent-to-Inbox action bridge；但候选人/manager 外部双边消息自动推进仍未完成。
- P4 `Client Delivery Loop` 已经有 Role Agent client delivery loop metrics/risks/next steps，并接入 Smart Report / delivery summary、token-gated public share report、invited customer account access policy、client-safe filtering、client-visible report field controls、report-version frozen delivery snapshot manifest、shareable delivery version history、weekly delivery archive manifest、independent weekly delivery archive storage/readback、Client Delivery Audit Center v1、CSV export、share view metrics、manager feedback capture、retained feedback audit history、metrics-derived and persisted client delivery audit trail 和 independent client delivery audit event storage；但还不是完整客户门户工作台。

结论：路线图已经从 PRD 进入 P0-P4 的第一层产品实现，并已补齐客户门户 workspace、P2 后台 `prepare_outreach`、P3 持久消息历史和 P1 HTTP provider hook。剩余工作主要依赖外部配置和真实账号验收：接入 live signal provider endpoint、跑登录态浏览器 QA、再根据真实使用数据决定是否升级为更完整的无人值守编排。

## 2. Audit Method

审计基于以下当前文件：

- `docs/superpowers/specs/2026-07-02-lev8-inspired-role-agent-prd.md`
- `PRODUCT.md`
- `README.md`
- `web/lib/role-agent-workspace.mjs`
- `web/lib/role-agent-metrics.mjs`
- `web/app/app/projects/[id]/page.tsx`
- `role-agent-workspace.test.mjs`
- `role-agent-metrics.test.mjs`
- `api-route-copy.test.mjs`

判断口径：

- `Executable`：用户点击 Role Agent action 后，会调用 API、写入状态、记录 metrics，或推进已有对象。
- `View model`：已经能在 Role Agent 中展示、排序、解释或汇总，但不代表有新的后台 provider、调度器或外部系统写入。
- `Roadmap gap`：产品目标明确，但当前实现仍缺少真实后台能力、端到端执行、分享/协作边界或验收证据。

## 3. P0-P4 Evidence Table

| Phase | Product intent | Current evidence | Status |
| --- | --- | --- | --- |
| P0 One-prompt Role Agent | 输入岗位后进入持续推进的 role workspace | `buildRoleAgentWorkspaceView` 聚合 goals/counts/health/next_actions/activity；项目页展示 Role Agent panel；capacity goals 保存到 settings；metrics 记录 panel/action/settings/events | Mostly implemented |
| P0 executable actions | 在一个 panel 里推进 sourcing/contact/outreach/follow-up/interested review | 项目页已有 `runRoleAgentSourcingAction`、`runRoleAgentContactResolutionAction`、`runRoleAgentOutreachApprovalAction`、`runRoleAgentFollowUpAction`、`runRoleAgentInterestedReviewAction`、`runRoleAgentRetryFailedOutreachAction` | Implemented with manual triggers |
| P1 Why-now Signal Layer | 让用户先看到现在该联系谁 | `why_now` 结合 reply/follow-up/contactability/fresh evidence/candidate/company/tech signals；`contact_timing` 输出 urgency/score/reason；live signal contract 输出 type/source/confidence/freshness/expires_at，并对过期信号降权；stale/expired signals 会进入 `refresh_live_signals` queue；`/api/cron/live-signals` 可 scheduled refresh，并写回 Role Agent run manifest | Implemented v1 |
| P2 Contact + Outreach Autopilot | 更短路径完成 contact、sequence、send/retry/recovery | Role Agent 可触发 bulk contact resolution、ready draft approval、follow-up Gmail draft、failed send retry；`autopilot_path` 和 `autopilot_recovery` 展示阶段、workflow run plan、target preview、guardrails、persisted run manifests、execution log、失败项和 last run；`/api/projects/[id]/role-agent-runs` 支持后台 sourcing/live signal run | Implemented v1 |
| P3 Inbox-to-Interview Pipeline | 从回复直接推进到可约面队列 | `inbox_pipeline` 输出 interested queue、interview-ready queue、next steps；item 有 scheduling_state、candidate/manager negotiation state、two-sided message history、activity_timeline、slot_held、Google Calendar event create/reschedule/cancel、confirmed/rescheduled/canceled writeback、handoff、calendar_status、recovery_next_step；confirmed interview 进入 client delivery loop 统计；Role Agent action 可应用第一个 inbox next step | Implemented v1 |
| P4 Client Delivery Loop | 把 Smart Report 升级成持续交付页 | `delivery_summary.client_delivery_loop` 输出本周新增、已联系、已回复、可约面/已确认、risks、next steps；项目页 Role Agent 区域和 public report 均展示该摘要；project-bound share report 需要 HMAC token 或 invited customer account access；share report 可按 delivery loop / Smart Report / candidate details / feedback form 分项控制；public report 展示 report-version frozen snapshot manifest、同项目最近交付版本历史和 weekly delivery archive manifest；weekly archive 会 best-effort 写入独立表并支持 persisted fallback readback；share view 和 manager feedback 会写入 metric 与 independent audit event storage；projects API 会读回 persisted audit events 并合并到 Role Agent client delivery audit trail；`/app/client-delivery` 提供团队侧审计后台和 CSV export；内部/debug action 会过滤 | Implemented v1 |

## 4. Executable Actions Vs View-model-only Capabilities

### 已经是真执行动作

- `run_sourcing`：创建 manual search task，并调用 search task run API。
- `resolve_contacts`：调用 bulk contact resolution API，并记录成功/失败。
- `approve_or_send_outreach`：先跑 bulk contact resolution，再把可发送首封草稿 PATCH 为 approved；当前明确不发送邮件。
- `follow_up`：为 due/follow_up_due threads 保存 Gmail follow-up drafts；当前明确不发送邮件。
- `review_interested_candidates`：复用现有 Inbox Agent next step bridge，应用第一个可执行 inbox step。
- `retry_failed_outreach`：对 failed approved outreach 调用 send API 重试，并写入 execution metrics。
- `next_action_execution` metrics：started/succeeded/failed 写入 recent events；terminal execution 记录 targets、result、failed_items、retryable，并被 activity/recovery history 消费。

### 主要还是 view model / UI 聚合

- P1 live signals：当前能消费 candidate/company/tech/profile/activity 字段并排序，也能识别 stale/expired signals 并生成 refresh queue；`/api/cron/live-signals` 会用 v1 provider 写入 refresh run manifest。剩余差距是真实外部 live signal provider。
- P2 autopilot：当前有 path、workflow preview、target preview、guardrails、persisted run manifests、recovery、可点击执行动作和后台 RoleAgentRun sourcing/live-signal refresh，但不是完整后台自动编排器；ready draft approval 仍不等于自动发送。
- P3 interview pipeline：当前可生成/保存 scheduling/handoff 信息，归一化候选人/manager 时间协商状态，展示 inbox-to-interview two-sided message history 和 activity timeline，创建/改期/取消 Google Calendar event 并写回 interview lifecycle；剩余差距是完整外部双边消息自动推进。
- P4 client delivery loop：当前在 Role Agent panel 和 token/account-gated public report 内展示持续交付摘要，并支持 manager feedback 写入 Role Agent metrics、Role Agent retained feedback audit history 和独立 client delivery audit event storage；share report 字段可见性和 customer account access policy 已有第一版配置，public report 可展示 report-version frozen snapshot manifest、同项目最近交付版本历史和基于 persisted report versions 的 weekly delivery archive manifest；weekly archive 已可 best-effort 写入独立 `client_delivery_weekly_archives` 表，并可从 persisted rows 还原为 share report fallback；团队侧 Role Agent 可展示 report view / feedback 派生和 persisted audit events 合并后的 client delivery audit trail；`/app/client-delivery` 已提供按项目/时间/事件类型筛选的审计后台和 CSV export；但还不是完整客户门户工作台。

## 5. P0 Acceptance Criteria Status

| Acceptance criteria | Status | Notes |
| --- | --- | --- |
| 进入 Role Workspace 能看到 Role Agent panel | Met | 项目页已有 Role Agent 区域。 |
| 显示 agent status、capacity goals、current counts、health summary | Met | `RoleOutreachSettings` + workspace view 聚合。 |
| 保存 capacity goals 后刷新可见 | Met | settings 持久化并有 metrics update。 |
| 最多 5 个 next best actions | Met | `next_actions` slice 控制展示数量。 |
| 覆盖 sourcing、lead review、contact resolution、outreach、follow-up、interested review | Met | action type 和 UI 分支均存在；新增 retry 作为恢复动作。 |
| disabled / blocked action 显示可理解原因 | Mostly met | paused/blocked reasons 已进入 action；仍需要浏览器 QA 检查所有 copy。 |
| preview leads 提示 review | Met | preview count 会生成 `review_preview_leads`。 |
| missing contact 提示 resolve contacts | Met | contact gap 会生成 `resolve_contacts`。 |
| draft / approved outreach 提示 approve/send | Met | ready count 会生成 `approve_or_send_outreach`；实际实现是 approve ready drafts, no send。 |
| interested / needs scheduling 提示 review interested candidates | Met | inbox candidate count 会生成 action，并可 bridge 到 inbox next step。 |
| pause 后展示状态历史，但不展示自动动作为执行中 | Mostly met | action blocked reason 支持 paused；需浏览器 QA 复核 UI copy。 |
| 不删除 CandidateGraph、Lead Preview、Gmail Outreach、Inbox Agent、Smart Report | Met | 当前实现是新增 Role Agent 汇总入口。 |

## 6. Remaining Product Gaps

### Gap 1: P1 live signal ingestion

当前已有 `why_now` 排序、contact timing、live signal contract、从现有 CandidateGraph 上下文推断信号的第一版 ingestion，以及 stale/expired signal refresh queue；但缺少完整外部信号生产链：

- 候选人活动、profile freshness、公司招聘动态、技术栈变化、最近项目/内容更新的 provider 级真实刷新机制。
- role-level “今天优先联系谁”的后台刷新或定时任务；当前 `refresh_live_signals` 会沉淀 provider-not-configured guardrail run manifest，而不是实际抓取。

建议下一步：把现有 `signal_refresh` queue 接 provider 或 scheduled refresh job，把信号生产从页面聚合推进到后台刷新。

### Gap 2: P2 full autopilot orchestration

当前 Role Agent action 是手动触发的短路径，并已有统一 workflow preview / run plan 和 persisted run manifests，但不是完整后台 autopilot：

- contact resolution、draft approval、send/follow-up/retry 尚未由后台 job 统一执行。
- 自动发送策略已有前台 guardrails / dry-run preview / run manifest 雏形，但缺少 per-role eligibility 持久化、batch rollback/retry。
- `approve_or_send_outreach` 当前只 approve，不 send；这符合当前安全状态，但与 P2 “自动发送/自动跟进”目标仍有距离。

建议下一步：把现有 `role_agent_runs` manifest 升级为后台 `RoleAgentRun` job，把当前 workflow preview 变成可恢复执行，并沉淀 per-step retry / rollback。

### Gap 3: P3 real interview scheduling

当前已有 interview-ready queue、handoff、calendar_status、scheduling draft、candidate/manager negotiation state、activity timeline、slot hold、Google Calendar event create/reschedule/cancel 和 interview lifecycle writeback，但缺少完整外部时间协商生命周期：

- 候选人与 hiring manager 的双边消息自动推进。
- persisted full message history across candidate/manager communication channels。

建议下一步：在现有 Calendar event lifecycle 和 activity timeline 基础上补候选人/manager 双边消息自动推进和持久化消息历史。

### Gap 4: P4 standalone client delivery page

当前 client delivery loop 在 Role Agent panel 和 token-gated share report 中可见，manager 也可以通过 share report 提交第一版反馈，招聘团队可在 Role Agent 里看到保留的反馈审计历史，并可控制 share report 展示 delivery loop、Smart Report、candidate details 和 feedback form；share report 也能展示 report-version frozen snapshot manifest、同项目最近交付版本历史和 weekly delivery archive manifest。但 P4 目标是客户/manager 可持续协作：

- 独立 shareable delivery page。
- 客户账号权限。
- 客户账号权限和更完整的客户门户协作；当前已有 metrics-derived audit trail、独立 client_delivery_audit_events 写入/读回、client_delivery_weekly_archives 写入/读回 fallback，以及团队侧 Audit Center v1 / CSV export。

建议下一步：在 Smart Report shareable flow 上扩展 `client_delivery_loop` 页面，而不是另起 BI dashboard。

### Gap 5: End-to-end browser QA

当前已有单元/字符串复制测试，但仍缺：

- 登录态下项目页浏览器 QA。
- Role Agent action 成功/失败 toast 和 disabled states 的真实交互验证。
- P1-P4 新区块在移动端和窄屏不重叠的截图验证。

建议下一步：准备可用 dev session 后跑 Playwright/browser QA，覆盖 Role Agent panel、next actions、P3 queue、P4 delivery loop。

## 7. Recommended Next Roadmap

### Done 1: Role Agent Execution Log

目标：补 P2 自动化地基。

范围：

- 记录每次 Role Agent action/run 的 input、targets、result、failed items、retryable state。
- 把当前 metrics recent events 保留为摘要，把 execution log 作为恢复来源。
- UI 展示最近 run、失败原因、可重试 candidates。

验收：

- 任意 action 失败后，用户能看到失败对象、失败原因和下一步。
- retry 不依赖临时 UI state。
- tests 覆盖 success/partial failure/failure retry。

当前状态：已实现第一版等价 execution log，写入 `role_agent_metrics.execution_log`，Role Agent recovery UI 展示 latest execution 和 retryable failed items。后续如果需要完整后台 workflow，再升级为独立 `RoleAgentRun` 数据对象。

### Done 2: Live Signal Contract

目标：把 P1 从排序逻辑升级为可持续信号层。

范围：

- 定义 candidate/company/tech/content signal schema。
- 从现有 evidence/source mix 生成第一版 signals。
- 增加 freshness、source、confidence、expires_at。
- `why_now` 使用 signal freshness 降权。

验收：

- 同一候选人有多个信号时能解释排序原因。
- 过期信号不会继续推高 “now” urgency。
- tests 覆盖 candidate activity、company hiring、tech stack、profile freshness。

当前状态：已实现第一版 signal contract normalization 和 CandidateGraph-derived ingestion。显式 `activity_signals`、`profile_freshness`、`company_signals`、`tech_stack_signals`、`recent_updates`，以及 `source_evidence` / `claims[].evidence` / profile updated time / company open roles / tech stack records 均可输出 type/source/confidence/freshness/expires_at；`why_now` 使用未过期信号加权，过期信号不再推高 `now` urgency。stale/expired signals 已能进入 `signal_refresh` queue 和 provider guardrail run manifest；剩余工作是接入真实外部 provider / scheduled refresh。

### Done 3: Inbox-to-Interview Scheduling State

目标：补 P3 面试推进闭环。

范围：

- 将 scheduling draft、calendar availability、handoff、confirmed/needs_recovery 统一为状态机。
- 支持 Calendar event create 或至少生成可恢复的 event draft。
- Role Agent activity history 显示 interested -> scheduling -> interview-ready -> confirmed。

验收：

- interested reply 可进入 scheduling state。
- 保存 draft 后显示恢复状态。
- confirmed 后进入 client delivery loop 的 interview-ready/confirmed 统计。

当前状态：已实现第一版 scheduling state normalization、slot hold、Google Calendar event creation、confirmed writeback、candidate/manager negotiation state 和 activity timeline。OAuth scope 已扩展到 `calendar.events`；`confirm_interview_event` 会 server-side 调用 Google Calendar events insert，并把返回的 `calendar_event_id` 写入 inbox action marker。Inbox item 可派生 `needs_scheduling`、`draft_saved`、`waiting_on_candidate`、`waiting_on_manager`、`aligning_times`、`ready_to_confirm`、`slot_held`、`interview_ready`、`confirmed`、`needs_recovery`；Role Agent UI 显示 scheduling/negotiation/confirmed/recovery summary 和最近活动；confirmed interview 会进入 Role Agent client delivery loop 的 weekly progress metrics。剩余工作是外部双边消息自动推进和持久化全量消息历史。

### Done 4: Shareable Client Delivery Loop

目标：补 P4 客户交付页。

范围：

- 在现有 Smart Report/shareable route 上加入 delivery loop 页面。
- 支持本周新增、已联系、已回复、可约面/已约面、风险、下一步。
- 客户可见字段过滤，避免暴露内部 action/debug 信息。

验收：

- share link 可打开持续交付页。
- manager/客户能看到 progress、risks、next steps。
- report view 事件进入 metrics。

当前状态：已在现有 `/r/[id]` shareable report 上展示 Client Delivery Loop，包含本周新增、已联系、已回复、可约面、已确认、风险、下一步；公开报告会过滤明显内部/debug 文案，并把 `client_report_view` 写入 Role Agent metrics。project-bound report 已加 deterministic HMAC share token，项目页和搜索完成状态会生成带 `?t=` 的链接，缺失/错误 token 不会渲染客户交付报告或写 view metric。manager feedback loop 已有第一版表单和 token-gated API，会把 `manager_feedback` / `client_delivery_feedback` 写入 Role Agent metrics，并在 Role Agent 中展示 retained feedback audit history。项目页 Role Agent Guardrails 已支持 client-visible report field controls，可控制 public report 的 delivery loop、Smart Report、candidate details 和 feedback form。public report 也会展示 report-version frozen snapshot manifest、同项目最近 search runs 派生的交付版本历史，以及按周聚合的 delivery archive manifest。client report view / feedback 已开始 best-effort 写入独立 `client_delivery_audit_events` 表，projects API 会读回这些事件并合并到 Role Agent Client delivery audit。weekly archive 也会 best-effort upsert 到独立 `client_delivery_weekly_archives` 表，并在没有可派生 report versions 时作为 persisted fallback。剩余工作是客户账号权限和完整审计后台。

### Done 5: Calendar Slot Hold, Event Creation, And Confirmed Writeback

目标：补 P3 约面推进的产品内闭环。

范围：

- Inbox action metadata 支持 slot hold、Google Calendar event id 和 confirmed writeback。
- Inbox Agent 从 action marker 生成 calendar availability / interview event state。
- Role Agent inbox pipeline 识别 `slot_held` 和 `confirmed`，并把 confirmed 计入 delivery loop。
- 项目页提供 Hold first slot / Confirm interview 动作；Confirm 会在具备 `calendar.events` scope 时创建 Google Calendar event。

验收：

- interested candidate 生成可约时间后可暂留 slot。
- confirmed event state 和 Google Calendar event id 可写回 inbox action marker。
- Role Agent pipeline 和 client delivery metrics 能读取 confirmed 状态。

当前状态：已完成第一版。后续由 Calendar event lifecycle 继续覆盖改期/取消。

### Done 6: Calendar Event Lifecycle

目标：补 P3 的 Google Calendar 事件生命周期。

范围：

- Google Calendar event update / reschedule / cancellation。

验收：

- reschedule 会 PATCH 既有 Google Calendar event，并写回 `rescheduled` lifecycle state。
- cancel 会 DELETE 既有 Google Calendar event，并写回 `canceled` lifecycle state。
- 项目页提供 Reschedule event / Cancel event 操作，且不绕到 Gmail send route。

当前状态：已实现第一版。`reschedule_interview_event` 和 `cancel_interview_event` 会通过 server-side Gmail/Calendar integration 调用 Google Calendar event patch/delete；Inbox action marker、Inbox Agent 和 Role Agent pipeline 均可识别 `rescheduled` / `canceled`；项目页提供改期/取消按钮和可恢复错误提示。

### Done 7: Client Delivery Share Token

目标：给 P4 shareable delivery report 增加第一层客户访问边界。

范围：

- project-bound search report 生成 deterministic HMAC share token。
- 项目页 Research Rounds 和搜索完成后的 Share Bar 使用带 token 的 `/r/[id]?t=...` 链接。
- `/r/[id]` 对 project-bound search report 校验 token；缺失/错误 token 不渲染报告，也不记录 `client_report_view`。

验收：

- 非项目 legacy report 仍可用。
- project-bound report 缺失/错误 token 会显示链接失效/需要有效分享链接。
- token 绑定 run、owner、project 和 updated_at，报告更新后 token 会变化。

当前状态：已实现第一版。仍不是完整客户账号权限系统。

### Done 8: Manager Feedback Loop

目标：让客户/manager 在 token-gated client delivery report 上直接给招聘团队反馈。

范围：

- `/r/[id]` project-bound search report 在有效 share token 下展示 feedback form。
- feedback API 复用 deterministic share token 校验，不要求客户登录。
- 反馈归一化为 `ready_to_interview`、`needs_more_candidates`、`needs_stronger_evidence`、`not_a_fit` 四类，并要求填写 note。
- feedback 写入 Role Agent metrics 的 `manager_feedback` event，action_type 为 `client_delivery_feedback`。
- Role Agent 从 metrics recent events 派生 retained feedback audit history，展示反馈总数、全部保留反馈、时间和 report link。

验收：

- 无效 token 或非 project-bound search report 不能写反馈。
- 成功反馈会进入 Role Agent activity history / metrics / retained feedback audit history。
- 公开报告主体不暴露内部 action/debug 信息。

当前状态：已实现第一版。Role Agent 已展示保留的反馈历史和 report link，反馈事件也会 best-effort 写入独立 client delivery audit event storage；仍不是完整客户门户，还缺客户账号权限、独立数据库周报归档表和完整审计后台。

### Done 9: Client-visible Report Field Controls

目标：让团队在分享客户交付报告前控制客户能看到哪些模块。

范围：

- `outreach_settings.client_delivery_visibility` 支持 `delivery_loop`、`smart_report`、`candidate_details`、`feedback_form` 四个开关。
- 旧的 `client_visible_digest=false` 会向后兼容地关闭 delivery loop、Smart Report 和 feedback form，但保留 candidate details。
- `/r/[id]` project-bound search report 读取项目设置，并按 visibility 条件渲染客户交付摘要、Smart Report、候选详情和反馈表单。
- 项目页 Role Agent Guardrails 提供 Client-visible report fields / 客户可见报告字段开关，并保存到现有 outreach settings。

验收：

- 默认 share report 仍展示完整交付视图。
- 关闭对应字段后，share report 不渲染对应模块。
- 设置保存会进入 Role Agent settings metrics，activity 中可读为 Client-visible report fields。

当前状态：已实现第一版。仍不是完整客户账号权限系统，也不是独立数据库周报归档表。

### Done 10: Shareable Delivery Version History

目标：让客户/manager 在交付页看到这个岗位最近几次客户可见交付版本，而不是只能看单次报告。

范围：

- `buildClientDeliveryVersionHistory` 从同项目 `search` runs 派生最近交付版本，标记当前版本、候选人数、交付时间和 report href。
- 版本历史过滤 verify runs 和明显内部/debug 文案。
- `/r/[id]` token-gated project-bound report 读取 `projectRuns`，在 Client Delivery Loop 后展示 Delivery versions / 交付版本历史。

验收：

- public report 只有在有效 share token 下才会构建并展示版本历史。
- 当前版本有 Current / 当前 标记。
- 每个历史版本使用已有 `clientDeliveryReportHref`，继续保留 report token。

当前状态：已实现第一版。它是基于 project search runs 的客户可见版本历史；weekly archive manifest 另见 Done 19，但仍不是独立数据库周报归档表或完整客户门户。

### Done 11: Retained Client Feedback Audit History

目标：让招聘团队看到客户/manager 从交付页提交过的保留反馈历史，而不是只看到最近摘要。

范围：

- `client_feedback_audit` 保留 `history` 和向后兼容的 `latest`。
- 每条 feedback history 展示 sentiment、reviewer、note、time 和 report href。
- 仅纳入 `manager_feedback` + `client_delivery_feedback`，内部 candidate note 不进入客户反馈审计。
- 项目页 Role Agent 客户反馈卡片展示可滚动历史，并可跳回对应 report。

验收：

- feedback event 末尾的 `/r/...` 或 `https://...` report link 被解析为 `report_href`。
- Role Agent UI 显示 View report / 查看报告。
- 非客户交付反馈不会污染客户反馈审计。

当前状态：已实现第一版。它覆盖当前 metrics retention 内的反馈历史，不是独立客户审计后台。

### Done 12: Report-version Frozen Delivery Snapshot Manifest

目标：让客户交付页显示当前报告版本对应的冻结交付快照，避免客户只看到会随上下文变化的实时摘要。

范围：

- `buildClientDeliverySnapshot` 基于 run id、run updated_at、当前交付 metrics、候选人 key、risks 和 next actions 生成稳定 `snapshot_id`。
- snapshot 记录 frozen_at、window、candidate_count、weekly metrics、evidence summary、risks 和 next actions。
- `/r/[id]` token-gated project-bound report 在 Client Delivery Loop 后展示 Frozen delivery snapshot / 冻结交付快照。
- snapshot 复用现有 client-safe filtering，不展示内部/debug/action log 文案。

验收：

- 同一 run + result 生成相同 `snapshot_id`。
- run updated_at 变化会生成不同 `snapshot_id`。
- public report 只有有效 share token 下才会展示 snapshot manifest。

当前状态：已实现第一版。它是 report-version anchored manifest；weekly archive manifest 另见 Done 19，但仍不是独立数据库周报归档表。

### Done 13: Candidate/Manager Time Negotiation State

目标：让 Role Agent 的 Inbox-to-Interview queue 能区分候选人和 manager 时间协商卡在哪一边，而不是只显示笼统待约面。

范围：

- `scheduling_negotiation` / `time_negotiation` 支持 candidate windows、manager windows、proposed slot、candidate confirmed slot 和 manager confirmed slot。
- `scheduling_state` 新增 `waiting_on_candidate`、`waiting_on_manager`、`aligning_times`、`ready_to_confirm`。
- `negotiation_state` 保留 candidate windows、manager windows、proposed slot 和 updated_at。
- Role Agent Inbox-to-Interview summary 显示 waiting on candidate、waiting on manager、ready to confirm。
- `recovery_next_step` 根据协商状态提示分享 manager availability、复核 candidate availability 或创建 Calendar event。

验收：

- 候选人给出时间但 manager 未确认时，状态为 `waiting_on_manager`。
- manager 给出时间但候选人未确认时，状态为 `waiting_on_candidate`。
- 双方确认同一 proposed slot 时，状态为 `ready_to_confirm`。

当前状态：已实现第一版。它是产品内状态归一化和下一步提示，不是外部双边消息自动发送器。

### Done 14: CandidateGraph-derived Live Signal Ingestion

目标：让 P1 why-now signal layer 不只消费预先标准化的 signal 字段，而能从现有 CandidateGraph 上下文生成第一版 live signals。

范围：

- 从 `source_evidence`、`evidence_sources`、`evidence_items`、`evidence` 和 `claims[].evidence` 推断 candidate activity / recent content signals。
- 从 `profile_updated_at` / `profile_refreshed_at` 推断 profile freshness。
- 从 `company_open_roles` / `hiring_signals` / `company_hiring_roles` 推断 company hiring signals。
- 从 `tech_stack` / `technologies` / `skills` record 推断 tech stack signals。
- 输出仍使用现有 `type/source/confidence/freshness/expires_at` live signal contract，并复用过期信号降权与 contact timing window。

验收：

- 候选人没有显式 `activity_signals` 时，evidence 更新仍会进入 `why_now.signals`。
- company open role 和 tech stack context 会进入 `signal_contract`。
- activity + company + tech 同时出现时，contact timing 可进入 `now`。

当前状态：已实现第一版。它是基于当前 CandidateGraph 数据的推断 ingestion，不是 provider 级实时抓取或后台 scheduled refresh。

### Done 15: Autopilot Workflow Preview / Run Plan

目标：让 P2 autopilot 不只是分散 stage count，而能在一个 run plan 中说明 contact -> approve -> send -> retry -> follow-up 的目标、下一步和 guardrails。

范围：

- `autopilot_path.workflow` 输出 mode、next_step、blocked_count、summary 和 steps。
- 每个 step 包含 type、count、status、can_auto_execute、guardrail 和最多 5 个 target preview。
- 首封邮件发送在 workflow 中明确显示为 guardrail blocked，不伪装成已经自动发送。
- 已批准跟进草稿在 `auto_follow_up_only` 模式下可显示为 auto-executable。
- 项目页 Autopilot path 卡片展示 Run plan、next step、blocked guardrails 和每步 target preview。

验收：

- 同一个 autopilot path 能同时展示待解析联系方式、待批准草稿、待首封发送、失败重试和到期跟进。
- follow-up auto-eligible 时 `can_auto_execute` 为 true。
- 首封发送仍显示 manual guardrail。

当前状态：已实现第一版。它是前台 workflow preview / dry-run plan，不是后台 `RoleAgentRun` job，也不新增无人值守首封发送。

### Done 16: Inbox-to-Interview Activity Timeline

目标：让 P3 队列不只显示当前 scheduling state，也能展示 interested reply 到约面推进之间的关键活动轨迹。

范围：

- `inbox_pipeline` item 新增 `activity_timeline`。
- 从现有 inbox item 字段派生 interested reply、scheduling draft saved、time negotiation、slot held、interview confirmed/rescheduled/canceled 事件。
- timeline 按时间倒序，最多保留 8 条。
- 项目页 interested queue 和 interview-ready queue 展示最近两条 activity timeline。

验收：

- 有 interested reply、草稿保存、时间协商、slot held 和 confirmed calendar event 时，timeline 能按最新事件优先输出。
- timeline 不伪造外部消息发送，只记录已有状态和已有时间戳。
- confirmed/rescheduled/canceled calendar event 能进入 timeline。

当前状态：已实现第一版。它是基于现有 inbox/action/calendar state 的派生活动历史，不是跨候选人和 hiring manager 通道的持久化全量消息历史。

### Done 17: Persisted Role Agent Run Manifest

目标：让 P2 autopilot 的执行不只停留在 UI run plan 和离散 execution log，而能沉淀一条可恢复 run manifest。

范围：

- `role_agent_metrics.role_agent_runs` 记录 `run_id`、`action_type`、`workflow_step`、`status`、`targets`、`result`、`failed_items`、`retryable`、`guardrail`、`started_at`、`finished_at`、`updated_at`。
- 同一 `run_id` 的 started / terminal event 会合并更新同一条 run manifest。
- `role-agent-events` API 转发 `targets`、`result`、`failed_items`、`retryable`、`run_id`、`workflow_step`、`guardrail`，避免前端 richer execution data 在 API 边界丢失。
- 项目页 Role Agent action started/terminal events 使用同一个 `run_id`。
- Role Agent recovery 区域展示最近 run manifest。

验收：

- started event 先写入 `started_at`。
- succeeded / failed / blocked event 使用同一 `run_id` 时更新 `finished_at`、result 和 failed_items。
- retryable failed_items 会进入 recovery 视图。

当前状态：已实现第一版。它是 project metrics JSON 内的 run manifest，不是独立数据库表或真正后台 worker job。

### Done 18: Live Signal Refresh Queue

目标：让 P1 why-now signal layer 不只判断 freshness，还能把 stale/expired signals 转成可执行、可恢复的 Role Agent 下一步。

范围：

- `signal_refresh` 输出 `status`、`provider_status`、`due_count`、`stale_count`、`expired_count`、`targets`、`last_run`。
- stale/expired candidate signals 会触发 `stale_live_signals` health blocker 和 `refresh_live_signals` next action。
- `refresh_live_signals` 进入 Role Agent action type / metrics / run manifest 体系。
- 项目页 refresh action 记录 provider-not-configured guardrail、targets、result 和 failed_items，而不是假装已经接入真实 provider。

验收：

- stale/expired signals 会生成 refresh queue。
- 用户点击 refresh action 后，系统有 blocked run manifest 和可重试失败项。
- Product / README / roadmap audit 明确当前是 refresh queue + provider guardrail，不是外部 crawler 或 scheduled refresh 已完成。

当前状态：已实现第一版。它是 Role Agent 内的刷新队列和 provider guardrail manifest；剩余工作是接入真实 live signal provider / cron job 并写回 refreshed candidate signals。

### Done 19: Weekly Client Delivery Archive Manifest

目标：让 P4 客户交付不只展示最近版本历史，而能按周形成可复看的交付归档。

范围：

- `buildClientDeliveryWeeklyArchive` 从 persisted project search runs / report versions 生成 weekly archive manifest。
- 每个 archive item 包含 `archive_id`、week start/end、latest report、latest snapshot、metrics、risks、next actions 和该周客户可见 report links。
- 同一周多次 report 不重复累计指标，而使用该周最新 frozen snapshot 作为周状态。
- public `/r/[id]` token-gated project-bound report 在 Client Delivery Loop 后展示 Weekly delivery archive / 周交付归档。
- archive 文案过滤内部/debug/role_agent 内容，并排除 verify runs。

验收：

- 多个 persisted report versions 可按周分组。
- 最新周在前，latest report 和 report links 可追溯。
- public report 只有在有效 share token 下构建并展示 archive。

当前状态：已实现第一版。它是基于 persisted report versions 的 deterministic archive manifest，不是独立数据库归档表，也不是完整客户账号/权限或审计后台。

### Done 20: Client Delivery Audit Trail

目标：让 P4 客户交付不只记录反馈摘要，还能在团队侧看到客户查看和反馈的审计时间线。

范围：

- `client_delivery_audit` 从 Role Agent metrics recent events 派生 report view 和 client feedback timeline。
- 输出 `counts.report_views`、`counts.feedback`、`latest_report_href`、`summary` 和 timeline。
- timeline 合并 `client_report_view` / `shareable_client_delivery_loop` 与 `manager_feedback` / `client_delivery_feedback`。
- 项目页 Role Agent 区域展示 Client delivery audit / 客户交付审计，包括报告查看次数、反馈数、最近报告和最近事件。

验收：

- report view 和 feedback 都能进入同一审计 timeline。
- feedback 继续保留 reviewer、sentiment、note 和 report href。
- 非客户交付 feedback / internal note 不进入 client feedback audit。

当前状态：已实现第一版。它是 metrics-derived audit trail，不是独立数据库审计表，也不是客户账号权限系统。

### Done 21: Independent Client Delivery Audit Event Storage

目标：让 P4 客户查看和反馈事件不只保存在 `role_agent_metrics.recent_events`，也能进入独立审计事件表，为后续客户门户、导出、保留策略和审计后台打底。

范围：

- 新增 `client_delivery_audit_events` migration，字段覆盖 `user_id`、`project_id`、`event_type`、`action_type`、`report_href`、`actor`、`sentiment`、`note`、`detail`、`event_at`。
- 新增 `buildClientDeliveryAuditEvent`，把 `client_report_view/shareable_client_delivery_loop` 归一化为 `report_view`，把 `manager_feedback/client_delivery_feedback` 归一化为 `feedback`。
- `recordProjectRoleAgentEvent` 在原 metrics 写入成功后 best-effort 写入独立 audit event storage；DB 不可用或表未创建时不阻断原流程。

验收：

- client report view 可以生成可持久化 audit event。
- client delivery feedback 可以保留 reviewer、sentiment、note、report href 和 event time。
- 非客户交付事件不会写入 audit event storage。

当前状态：已实现第一版独立事件存储接口和 migration；仍不是客户账号权限系统，也不是完整审计后台 UI。

### Done 22: Persisted Audit Trail Readback

目标：让独立 `client_delivery_audit_events` 不只被写入，也能回到团队侧 Role Agent 审计视图，形成可用的审计后台雏形。

范围：

- `listClientDeliveryAuditEvents` 从 `client_delivery_audit_events` 按 project / user 读取最近事件，DB 不可用或表未创建时返回空数组。
- `/api/projects/[id]` 返回 `clientDeliveryAuditEvents`。
- 项目页把 `clientDeliveryAuditEvents` 传入 `buildRoleAgentWorkspaceView`。
- `client_delivery_audit` 合并 persisted audit events 与现有 metrics-derived events，并按 event time 倒序去重展示。

验收：

- 即使 `role_agent_metrics.recent_events` 为空，persisted report view / feedback 也能生成 Client delivery audit timeline。
- persisted feedback 保留 actor、sentiment、note、report href 和 event time。
- metrics-derived events 与 persisted events 不重复展示同一条审计记录。

当前状态：已实现第一版 readback 和 Role Agent 审计卡片合并；仍不是独立审计后台列表页、导出页或客户账号权限系统。

### Done 23: Independent Weekly Delivery Archive Storage

目标：让 P4 周交付归档不只依赖 report-version 派生，也能进入独立数据库周归档表，为客户门户、导出和审计后台提供稳定读取来源。

范围：

- 新增 `client_delivery_weekly_archives` migration，按 `user_id + project_id + archive_id` 唯一保存周归档。
- 新增 `buildClientDeliveryWeeklyArchiveRow`，把 `buildClientDeliveryWeeklyArchive` 的 archive item 归一化为可 upsert 的 DB row。
- 新增 `buildClientDeliveryWeeklyArchiveFromRows`，把 persisted weekly archive rows 还原为 share report 可渲染的 weekly archive view。
- `upsertProjectClientDeliveryWeeklyArchive` 在 public report 构建 weekly archive 后 best-effort upsert；失败不影响 share report 渲染。
- `listProjectClientDeliveryWeeklyArchives` 支持从独立表读回，并在 public report 没有可派生 report versions 时作为 fallback。

验收：

- weekly archive item 可以生成稳定 DB row，保留 week range、latest report/snapshot、metrics、risks、next actions 和 report links。
- persisted weekly archive rows 可以还原成 share report weekly archive view。
- public report 仍优先使用当前 report versions 派生的 archive；独立表不可用不会阻塞客户报告。

当前状态：已实现第一版 storage/readback/fallback；仍不是完整客户门户里的周报列表页、导出页或客户账号权限系统。

### Done 24: Client Delivery Audit Center v1

目标：把已落地的 `client_delivery_audit_events` 和 `client_delivery_weekly_archives` 从项目详情内的局部卡片/表数据升级成团队侧可筛选、可查看、可导出的客户交付审计工作台。

范围：

- 新增 `/app/client-delivery` authenticated app page，并接入左侧/移动导航。
- 新增 `/api/client-delivery/audit`，按当前登录用户返回 `summary`、`events`、`weekly_archives`、`projects`。
- 新增 `/api/client-delivery/audit/export`，按相同筛选条件导出 CSV。
- 支持 project、range、type 过滤，顶部展示 report views、feedback、weekly archives、latest activity。
- Audit Center timeline 展示 report view / feedback；weekly archive list 展示周归档 metrics、latest report、risks 和 next actions 简要。

验收：

- dashboard view 能从 audit events + weekly rows 生成 summary、timeline 和 weekly archive list。
- project/range/type filter 生效。
- CSV export 字段顺序稳定：`project,event_type,actor,sentiment,note,report_href,event_at,archive_id,week_start,week_end,latest_report_id`。
- 导出和 UI 不包含内部/debug/role_agent/execution_log 文案。

当前状态：已实现团队侧 Audit Center v1 和 CSV export；客户账号权限在 Done 25 进入 v1，仍不是完整客户门户工作台。

### Done 25: Role Agent Backend Runs, Live Signal Cron, Customer Access, Message History

目标：补齐剩余 P1/P2/P3/P4 的最小可运行闭环，让系统不再只依赖前端按钮和 token 分享。

范围：

- 客户账号权限 v1：`client_delivery_access` 支持 `token_only` / `token_or_customer_account`，允许按邮箱或域名授权；public report 和 feedback API 同时接受有效 share token 或受邀登录账号。
- P1 live signal provider / cron v1：新增 `/api/cron/live-signals`，用现有 CandidateGraph / Role Agent workspace 选择 stale/expired live signal targets，并用 `candidate_activity_snapshot` provider 记录 refresh run。
- P2 后台 RoleAgentRun job v1：新增 `/api/projects/[id]/role-agent-runs` 和 server runner，支持 `run_sourcing`、`refresh_live_signals` 后台执行，并复用现有 Role Agent metrics/run manifest。
- P3 双边消息历史 v1：从 outreach thread、inbox thread、Gmail synced message payload 归一化 `message_history`，在 inbox-to-interview queue 展示 inbound/outbound 摘要。

验收：

- share report/feedback 在缺少 token 时，可按登录账号邮箱/域名授权访问；未授权账号仍被拒绝。
- live signal cron 由 `CRON_SECRET` 保护，并写入 Role Agent refresh run。
- RoleAgentRun 后台接口能创建 sourcing search task/run，或刷新 live signals。
- inbox-to-interview queue 暴露 two-sided message history，避免用户只看到分类结果而看不到对话上下文。

当前状态：已完成 v1。仍不是完整客户门户工作台；真实客户账号登录链路和移动端/登录态浏览器 QA 仍需最终验收。

### Next 1: Browser QA and Customer Portal Hardening

目标：用真实登录态确认端到端体验，并把客户门户从 report-level access 升级成完整 workspace。

范围：

- 登录态浏览器 QA 覆盖 Role Agent panel、shareable report、移动端布局。
- 客户门户协作页：客户登录后查看所有被授权项目/报告/周归档/反馈，而不是只从单个 report link 进入。
- 真实 live signal provider 替换 v1 `candidate_activity_snapshot` provider。

## 8. Verification Plan

本审计文档完成后，需要运行：

- `node --test api-route-copy.test.mjs calendar-availability.test.mjs gmail-outreach.test.mjs inbox-actions.test.mjs inbox-agent.test.mjs role-agent-metrics.test.mjs role-agent-workspace.test.mjs smart-report.test.mjs`
- `git diff --check`
- `npm --prefix web run build`

如果本轮没有修改代码，测试用于证明当前 roadmap worktree 的实现仍能通过核心验证，而不是证明 P1-P4 已全部完成。
