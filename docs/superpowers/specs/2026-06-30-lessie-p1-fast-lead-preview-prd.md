# P1 PRD: Fast Lead Preview

日期：2026-06-30

## 1. Summary

`Fast Lead Preview` 解决 SignalHire 搜索等待时间的体验问题：用户提交一个岗位 brief 后，不必等完整 deep research 结束才看到候选人方向，而是先看到一组明确标注为 `unverified lead` 的候选线索。

这个阶段不是为了更快“推荐候选人”，而是为了更快给用户反馈：系统正在找哪些人、来自哪些来源、为什么可能相关、还缺什么证据。

## 2. Product Promise

> Start a role search and see candidate leads as soon as SignalHire finds them. They stay clearly marked as unverified until public evidence and contact provenance are checked.

中文表达：

> 提交岗位后，SignalHire 会先展示未验证候选线索；只有完成公开证据和联系方式来源校验后，线索才可能进入推荐名单或外联流程。

## 3. Why This Matters

Lessie 强调快速返回结果，这对招聘工具很重要。SignalHire 的 deep research 更重、更可信，但如果几分钟内界面没有可见进展，用户会误以为搜索卡住。

P1 的价值是：

- 降低等待焦虑。
- 让用户提前判断搜索方向是否正确。
- 在深度证据生成前收集用户反馈。
- 保持 SignalHire 的可信边界：未验证就是未验证，不可外联，不可推荐。

## 4. Users And Jobs

### Founder / Hiring Manager

Job：提交一个岗位后，想快速知道系统是否理解了目标人才方向。

成功体验：1-2 分钟内看到几个 candidate leads，并能判断方向是否偏了。

### Recruiter

Job：不想等完整报告才发现搜索关键词错了，希望提前修正 sourcing direction。

成功体验：preview 中看到 source、possible match reason、missing evidence，并能决定是否继续等待或调整 brief。

### Agency / Headhunter

Job：需要向客户展示工作进展，但不能把未经验证的人当作正式推荐。

成功体验：可以说“系统已发现这些线索，正在补证据”，而不是交付模糊名单。

## 5. Scope

### In Scope

- 新增 `LeadPreviewView` view model。
- 从 active run 的 progress / agent execution 中提取候选线索。
- 直接接入 `open_evidence_leads`，不把它推迟到 future input。
- 在 Role Workspace 和 Search workspace 同时展示 `Unverified Lead Preview`。
- 允许用户对 preview lead 标记 `not relevant`，并把反馈写入下一轮 search constraints。
- 每条 lead 显示：
  - name
  - headline / current role
  - company
  - source type
  - source URL
  - possible match reason
  - missing evidence
  - next verification step
  - confidence
- feedback state：relevant / not relevant / untouched
- 明确禁用 outreach / approve / send。
- deep research 完成后，preview 状态变为 `verified_results_available`，由 shortlist / evidence packet 接管。

### Out Of Scope

- 不新增数据库表。
- 不做候选人推荐排序。
- 不做联系方式解析。
- 不对 preview lead 开放外联。
- 不把 preview lead 自动加入 shortlist。
- 不做免费 SEO 工具。

## 6. User Flow

### Flow A: Active Search Has Leads

1. 用户创建 search、进入 Search workspace，或进入 Role Workspace。
2. 搜索状态为 `queued` / `running` / `retrying`。
3. worker progress 中出现 candidate submission events，或 `open_evidence_leads` 已写入当前 run。
4. UI 显示 `Unverified lead preview`。
5. 用户看到每条 lead 的来源、可能匹配原因和缺失证据。
6. 用户等待 deep research 完成，或调整 brief /下一轮搜索约束。

### Flow A1: User Marks A Preview Lead Not Relevant

1. 用户在 preview lead 上点击 `Not relevant`。
2. UI 立即把该 lead 标为 muted / not relevant。
3. 系统把 lead 的 name、source type、source URL、possible match reason 和 feedback reason 写入下一轮 search constraints。
4. 下一轮 search task / project feedback preference 读取该约束，避免继续扩展相同方向。
5. 该反馈不能删除原始 evidence lead，也不能改变已完成 shortlist。

### Flow B: Active Search Has No Leads Yet

1. 用户进入 Role Workspace。
2. 搜索正在运行，但没有 lead events。
3. UI 不展示空卡片堆，只在搜索状态区域展示 “waiting for leads”。

### Flow C: Search Completed

1. research run 完成。
2. result 中已有 shortlist / candidates。
3. Lead Preview 隐藏，用户看正式 evidence-backed shortlist。

## 7. Data Contract

### `LeadPreviewView`

```ts
type LeadPreviewView = {
  status: "waiting_for_leads" | "preview_available" | "verified_results_available";
  items: LeadPreviewItem[];
  feedback_constraints: LeadPreviewConstraint[];
};
```

### `LeadPreviewItem`

```ts
type LeadPreviewItem = {
  id: string;
  label: "unverified lead";
  candidate_name: string;
  headline: string;
  company: string;
  source_type: string;
  source_url: string;
  possible_match_reason: string;
  missing_evidence: string[];
  next_verification_step: string;
  confidence: "high" | "medium" | "low" | string;
  feedback_state: "untouched" | "relevant" | "not_relevant";
  can_outreach: false;
};
```

### `LeadPreviewConstraint`

```ts
type LeadPreviewConstraint = {
  lead_id: string;
  feedback: "not_relevant";
  reason: string;
  source_type: string;
  source_url: string;
  candidate_name: string;
  next_search_instruction: string;
};
```

### Source Inputs

第一版按优先级读取：

1. `research_runs.progress.agent_execution.candidate_submission_events`
2. `open_evidence_leads`，必须按 `source_run_id` 或项目最近 active run 绑定读取
3. `research_runs.result.agent_execution.candidate_submission_events`，仅当 result 尚无 shortlist 时使用
4. provider / OpenJobs rows，作为 optional input，不阻塞 P1

## 8. UI Requirements

### Placement

第一版必须放在两处：

1. Role Workspace 详情页，位于 Autonomous sourcing panel 上方或下方。
2. Search workspace，靠近当前 run progress / result 区域。

原因：

- Role Workspace 已经是项目候选池和 sourcing 状态中心。
- 用户可以把 preview 和 source mix、contact coverage 放在同一上下文理解。
- Search workspace 是用户等待 live research 的第一现场，必须在这里降低等待焦虑。

### Visual Hierarchy

- Header：`Unverified lead preview` / `未验证候选线索预览`
- Supporting copy：必须说明这些不是推荐候选人。
- Lead cards：最多展示 6 条，避免用户把 preview 当完整列表。
- Source chip：展示 source type。
- Warning chip：固定展示 `unverified lead`。
- Next step box：说明需要公开证据和联系方式来源验证。
- Feedback action：允许 `Not relevant`，但只影响下一轮 search constraints。

### Forbidden UI

Preview lead 不允许出现：

- Approve
- Send
- Resolve contact
- Add to outreach
- Recommended
- Interview-ready

## 9. Rules And Guardrails

- `can_outreach` 永远是 `false`。
- `label` 固定为 `unverified lead`。
- 没有 source URL 的 lead 仍可展示，但 confidence 默认为 low。
- 没有 name 的 lead 只能显示为 `Unnamed lead`，不能伪造姓名。
- preview lead 不能改变 shortlist item 状态。
- preview lead 不能触发 contact provider 成本消耗。
- `Not relevant` 反馈不能删除原始 lead，只能写入下一轮 search constraints。
- `Not relevant` 反馈必须保留 source URL / source type，避免误伤同名候选人。

## 10. Empty, Loading, Error States

- `waiting_for_leads`：不渲染 lead card；在搜索状态区域提示等待线索。
- `preview_available`：渲染 preview panel。
- `verified_results_available`：隐藏 preview panel。
- malformed progress payload：忽略无效行，不阻塞页面。
- duplicated source URL：合并为一条。

## 11. Metrics

- `first_preview_lead_ms`：从 run created 到第一条 preview lead 的时间。
- `preview_lead_count`：每次 active run 展示的 preview 数量。
- `preview_to_shortlist_rate`：preview lead 最终进入正式 shortlist 的比例。
- `preview_hidden_after_completion_rate`：完成后 preview 是否正确隐藏。
- `preview_not_relevant_rate`：preview lead 被标记不相关的比例。
- `next_search_constraint_applied_rate`：not relevant 反馈被下一轮 search constraints 读取的比例。

## 12. Acceptance Criteria

- live research 未完成时，项目页能展示 unverified leads。
- live research 未完成时，Search workspace 能展示 unverified leads。
- 每条 lead 都有 `unverified lead` 标签。
- 每条 lead 都显示 source type 和 next verification step。
- `open_evidence_leads` 直接参与 preview 输入。
- 用户能点 `Not relevant`，反馈进入下一轮 search constraints。
- preview lead 没有外联、批准、发送、联系方式解析入口。
- 搜索完成并有 verified shortlist 后 preview 隐藏。
- malformed / duplicated progress event 不导致页面崩溃。

## 13. Test Plan

- Unit test：`buildLeadPreviewView` 从 progress events 生成 preview。
- Unit test：重复 source URL 去重。
- Unit test：`open_evidence_leads` rows 生成 preview。
- Unit test：`not relevant` 反馈生成下一轮 search constraint。
- Unit test：completed result 有 shortlist 时返回 `verified_results_available`。
- Source guard：项目 API 返回 `leadPreview`。
- Source guard：Search workspace 渲染 `LeadPreviewPanel`。
- Source guard：页面包含 `LeadPreviewPanel` 和 `unverified lead`。
- Build：`npm --prefix web run build`。

## 14. Confirmed Decisions

- 允许用户对 preview lead 点 `Not relevant`，并把反馈写入下一轮 search constraints。
- `open_evidence_leads` 直接接入 P1。
- Search workspace 和 Role Workspace 都展示 preview。
