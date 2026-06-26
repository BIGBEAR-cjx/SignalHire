# Autonomous Recruiter P2d PRD: Scheduling Coordinator

## 1. Summary

P2d 的目标是把 P2b/P2c 已有的 interested reply 和 handoff packet 推进成更明确的 scheduling coordinator。用户在 Role Workspace 中看到 interested candidate 后，不需要自己重新组织上下文，而是可以直接复制或保存一段候选人可读的约面回复，并把候选人标记为 interview-ready。

本阶段仍然 human-in-loop：不接 Google Calendar，不自动发送邮件，不自动发送 follow-up，不读取更多 Gmail 权限。

## 2. Goals

- 每个 interested candidate 都有结构化 scheduling packet。
- scheduling packet 包含候选人可读的 `candidate_reply`，明确提出 2-3 个时间窗口，但不声称已经约面。
- Role Workspace 的 interested queue 展示“下一步该约面”的队列，而不是只展示普通 handoff。
- 用户可以复制候选人约面回复，也可以复制 hiring manager handoff。
- `Mark interview-ready` 后状态持久化，刷新后不再计入 needs scheduling。
- 低证据/未验证风险继续显示在 handoff 中，避免把未核实候选人包装成强推荐。

## 3. Non-Goals

本阶段不做：

- Google Calendar API。
- 自动创建 calendar invite。
- 自动发送候选人回复。
- 自动发送 follow-up。
- Gmail modify / label 权限。
- ATS 同步。
- 付费或按 interview-ready 计费。

## 4. Primary User Stories

### Recruiter

作为 recruiter，我希望 interested 候选人自动带出一段可复制的约面回复，这样我不用重新写邮件，也不需要翻找候选人的证据和风险。

### Hiring Manager

作为 hiring manager，我希望收到的 handoff 包含候选人为什么值得聊、还有哪些风险和面试问题，这样我能快速决定是否安排面试。

### Founder

作为 founder，我希望 Role Workspace 顶部明确告诉我还有多少人需要约面处理，而不是让我自己从 inbox 分类里判断。

## 5. Product Scope

### P2d.1 Scheduling Packet View Model

范围：

- 扩展 `scheduling_packet`，新增：
  - `candidate_reply`
  - `handoff_title`
  - `hiring_manager_note`
  - `verified_summary`
  - `risk_summary`
- `candidate_reply` 必须：
  - 引用候选人回复上下文。
  - 简短说明岗位相关性。
  - 请求 2-3 个可用时间窗口。
  - 不声称已经安排面试或已发送邀请。

验收：

- interested candidate 的 scheduling packet 包含 candidate-facing reply。
- candidate reply 不包含自动发送或 calendar invite 暗示。
- empty evidence 时仍明确说需要 hiring review。

### P2d.2 Scheduling Action Persistence

范围：

- 继续复用 `/api/inbox/actions` 的 `schedule` action。
- `schedule` action 写入：
  - `action_status: "interview_ready"`
  - `scheduling_message`
  - `action_applied_at`
- Role Workspace 刷新后 interview-ready 候选人不再计入 `needs_scheduling`。

验收：

- schedule action 能保存 candidate reply。
- 刷新后 action status 仍是 interview_ready。
- `needs_scheduling` 只统计 pending schedule items。

### P2d.3 Role Workspace UX

范围：

- Interested Candidate Queue 增加：
  - `Copy candidate reply`
  - `Copy manager handoff`
  - `Mark interview-ready`
  - action status 显示
- 顶部 inbox priority line 优先提示待约面数量。
- 已 interview-ready 的候选人显示完成状态，不重复催促。
- 移动端不能横向溢出。

验收：

- recruiter 能直接复制候选人约面回复。
- hiring manager handoff 与候选人回复区分清楚。
- 已处理项状态清楚，不误导为仍待处理。

## 6. Test Plan

Unit tests:

- `inbox-agent.test.mjs`
  - interested packet includes `candidate_reply` and manager note.
  - candidate reply asks for 2-3 time windows and does not imply calendar invite.
  - needs_scheduling excludes interview_ready action state.

- `inbox-actions.test.mjs`
  - schedule action persists `scheduling_message`.
  - schedule action maps to `interview_ready`.

Source/API tests:

- `api-route-copy.test.mjs`
  - Role Workspace renders Copy candidate reply, Copy manager handoff, Mark interview-ready, and interview-ready status.

Verification:

- `node --test inbox-agent.test.mjs inbox-actions.test.mjs api-route-copy.test.mjs`
- `npm --prefix web run build`
- Two independent agents:
  - Product function acceptance.
  - UX acceptance.

## 7. Rollout Plan

1. Add failing tests for scheduling packet and action persistence.
2. Extend inbox agent scheduling packet view model.
3. Update Role Workspace interested queue controls/copy.
4. Run tests and build.
5. Run two acceptance agents.
6. If accepted, commit branch and prepare release PRD before merge/push.
