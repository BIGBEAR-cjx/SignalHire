# Autonomous Recruiter P2l Release PRD: Approval Retry Controls

## 1. Release Scope

P2l adds a narrow retry control for failed outreach approval outcomes in Role Workspace. It is a frontend safety and recovery improvement on top of P2k.

## 2. User-Facing Behavior

- If `Resolve & approve ready` partially or fully fails approval PATCH calls, the outcome panel lists failed candidates.
- The panel now shows `Retry failed approvals` / `重试失败批准`.
- Retry attempts only the failed rows from the visible outcome.
- Retry does not re-run contact resolution.
- Retry does not send email.

## 3. Safety Boundaries

- Only current `drafted` outreach threads can be retried.
- Duplicate, blank, missing, or no-longer-drafted failed rows are ignored.
- Gmail send routes are not invoked.
- Contact provider routes are not invoked.
- Server state remains the source of truth after refresh.

## 4. Rollout Checks

- `selectOutreachApprovalRetryTargets` filters failed approval rows against current queue state.
- Role Workspace imports and uses the retry helper.
- Retry PATCH failures are captured per target.
- Retry updates the same approval outcome component with latest success/failure counts.
- Bulk contact resolution and prepare controls are disabled while retry is running.

## 5. Known Residual Risks

- Retry remains manual; there is no automatic retry or backoff.
- If the queue changes between failure and retry, missing or no-longer-drafted rows are skipped and the next workspace refresh remains authoritative.
- P2l does not solve scheduling; P3 should still handle interview scheduling assistant work separately.
