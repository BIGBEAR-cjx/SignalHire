# P4 PRD: Persistent Role Agent Controls

日期：2026-07-01

## 1. Summary

`Persistent Role Agent Controls` upgrades the current read-only Role Agent Guardrails panel into a controlled role-level operating panel. Recruiters can persist capacity targets, agent status, digest preference, and approval mode while SignalHire continues to block first-email auto-send and high-confidence auto-send.

## 2. Product Promise

> Keep a role agent configured across sessions without giving it unsafe sending authority.

中文表达：

> 让岗位 agent 的目标和状态可持久化，但不放开危险自动发送权限。

## 3. Users And Jobs

### Recruiter

Job：给岗位设置 contacted / replied / interested / interview-ready 目标，并暂停或恢复 agent 工作。

成功体验：刷新页面后目标仍在；暂停状态清楚影响下一步建议；首封外联仍需人工批准。

### Hiring Manager / Founder

Job：看懂这个岗位是否正在推进，以及还有多少候选人缺口。

成功体验：不用理解后台任务，也能看到 capacity pressure 和需要人工处理的地方。

## 4. Scope

### In Scope

- Extend role outreach settings with:
  - `agent_status`: `active` / `paused`
  - `capacity_goal`: contacted, replied, interested, interview_ready
  - `approval_mode`: `manual_all` / `auto_follow_up_only`
  - `client_visible_digest`
- Persist these values through the existing project outreach settings route.
- Role Agent Guardrails panel shows:
  - persisted status
  - capacity goal progress
  - pause / resume toggle
  - compact goal inputs
  - manual-first approval mode
- Normalize unsafe settings:
  - `auto_high_confidence` is discarded / blocked.
  - first email remains manual.

### Out Of Scope

- New background scheduler.
- New database table.
- Automatic first email sending.
- High-confidence auto-send.
- Contact-provider changes.

## 5. Data Contract

```ts
type RoleOutreachSettings = {
  auto_follow_up_only: boolean;
  follow_up_interval_days: 7;
  client_visible_digest: boolean;
  agent_status: "active" | "paused";
  approval_mode: "manual_all" | "auto_follow_up_only";
  capacity_goal: {
    contacted: number;
    replied: number;
    interested: number;
    interview_ready: number;
  };
};
```

## 6. Acceptance Criteria

- Saving role agent settings survives a project reload.
- Pause/resume updates `agent_status`, not project status.
- Capacity inputs are clamped to safe non-negative integers.
- `approval_mode=auto_high_confidence` is normalized to `manual_all`.
- First email remains manual in helper tests and UI copy.

## 7. Metrics

- Roles with capacity goal configured.
- Roles paused/resumed.
- Roles using follow-up review draft mode.
- Manual approvals completed after agent next-task prompt.
