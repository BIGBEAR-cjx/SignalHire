# Autonomous Recruiter P2l: Approval Retry Controls

## Summary

P2k already makes approval failures visible after `Resolve & approve ready`. P2l closes the smallest remaining gap: when some ready outreach drafts fail to move from `drafted` to `approved`, the user can retry only those failed approvals without re-running contact resolution and without sending email.

## Problem

After a partial approval failure, the current summary lists failed candidates but leaves the next action ambiguous. The user can re-click the full prepare action, but that also re-runs contact resolution and makes the intent less precise.

## Goals

- Show an explicit retry action when `approvalOutcome.failed_items` is non-empty.
- Retry only failed approval IDs from the local outcome.
- Only retry rows that still exist in the current outreach queue and remain `drafted`.
- Preserve the safety language that no emails are sent.
- Keep provider cost controlled by not calling contact resolution during retry.

## Non-Goals

- No automatic retry.
- No new backend API.
- No Gmail send.
- No inbox reply sync or classification.
- No contact provider lookup during retry.
- No schema migration.
- No scheduling assistant.

## UX Requirements

- In the approval outcome panel, failed rows remain visible with candidate name and error.
- When failed rows exist, show `Retry failed approvals` / `重试失败批准`.
- While retry is running, disable bulk contact resolution, prepare, and retry controls.
- Explain that retry only approves existing drafts and sends no email.
- If the retry succeeds, show the updated approval outcome.
- If the retry still fails, keep the failed candidate and latest error visible.

## Functional Requirements

- Add a helper that derives retry target IDs from `failed_items` and current outreach queue items.
- The helper must ignore malformed IDs, missing queue rows, duplicate IDs, and rows whose current status is not `drafted`.
- Retry must PATCH `/api/outreach-threads/[id]` with `status: "approved"` and fallback sequence messages.
- Retry must collect per-target failures with try/catch and feed `buildOutreachApprovalOutcome`.
- Retry must not call `/api/contact-resolution/bulk`.
- Retry must not call `/api/outreach-threads/[id]/send` or `/api/inbox/actions/send`.

## Acceptance Criteria

- A partial approval failure exposes a retry button in the approval outcome block.
- Clicking retry only attempts failed IDs from the current outcome.
- Contact provider lookup count is unchanged by retry.
- Gmail send is never invoked by retry.
- The user can see whether retry approved all, some, or none of the failed drafts.

## Verification

- Add failing tests first for retry target selection and Role Workspace source contract.
- Run focused Node tests.
- Run frontend build.
- Run two independent agents:
  - Product function acceptance.
  - UX and safety acceptance.
