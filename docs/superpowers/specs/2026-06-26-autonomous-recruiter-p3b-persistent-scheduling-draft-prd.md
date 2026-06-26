# Autonomous Recruiter P3b: Persistent Scheduling Draft State

## 1. Summary

P3a can generate a calendar-aware scheduling draft, but the draft currently lives only in the browser session. P3b makes that draft a persistent, reviewable state in the existing Inbox Agent action system.

The user can save a generated scheduling draft, refresh the Role Workspace, and still see that the candidate has a saved scheduling draft. Marking a candidate interview-ready will use the saved/generated calendar-aware draft instead of falling back to the older generic scheduling prompt.

## 2. Problem

Calendar-aware scheduling is only useful if it survives page refresh and team handoff. A recruiter should not lose suggested windows after generating them, and the Role Workspace funnel should distinguish:

- interested candidate still needing scheduling work
- scheduling draft saved for review
- interview-ready handoff completed

## 3. Goals

- Add a persistent `save_scheduling_draft` inbox action.
- Store the generated calendar-aware draft in existing outreach thread action metadata.
- Keep `save_scheduling_draft` as `draft_saved`, not `interview_ready`.
- Keep `needs_scheduling` count active until the user explicitly marks interview-ready.
- Let `Mark interview-ready` reuse the latest saved/generated scheduling draft.
- Show saved scheduling draft status and copy controls in Role Workspace after refresh.

## 4. Non-Goals

- No Google Calendar event creation.
- No calendar invite sending.
- No candidate email sending.
- No schema migration.
- No new table.
- No role-level auto-approval rule.
- No multi-interviewer scheduling.

## 5. Functional Requirements

### Action Model

- Extend `INBOX_ACTIONS` with `save_scheduling_draft`.
- `save_scheduling_draft` stores:
  - `action_status: "draft_saved"`
  - `scheduling_message`
  - `action_applied_at`
- It should update outreach thread status to `replied`, preserving the inbox thread as a candidate reply context.
- It should not write `body`, `sent_at`, `gmail_message_id`, or `calendar_event_id`.
- `parseInboxActionState` should read the saved scheduling message.

### Queue Behavior

- `buildInboxQueue` should continue counting `save_scheduling_draft` / `draft_saved` interested candidates in `needs_scheduling`.
- Interested candidate cards should display the saved scheduling draft and `Draft saved` status.
- `Mark interview-ready` should persist the saved/generated calendar-aware draft as the final `schedule` action message.

### Role Workspace UX

- After generating a calendar-aware draft, show `Save scheduling draft` / `保存约面草稿`.
- If a scheduling draft was already saved, show it as a copyable saved draft.
- The safety copy remains explicit: saving does not send email or create a calendar invite.
- The existing `Mark interview-ready` button remains separate.

## 6. Acceptance Criteria

- Saving a scheduling draft persists action metadata and survives queue rebuild.
- Saved scheduling drafts are still counted as needing scheduling until marked interview-ready.
- Marking interview-ready uses the latest saved/generated scheduling draft.
- UI exposes save/copy controls and no-auto-send/no-invite copy.
- Tests prove no send route, Calendar event API, or schema migration is introduced.

## 7. Test Plan

Unit tests:

- `inbox-actions.test.mjs`
  - `save_scheduling_draft` persists scheduling message with `draft_saved`.
  - saved scheduling draft does not write email body or send fields.
- `inbox-agent.test.mjs`
  - saved scheduling draft remains in `needs_scheduling`.
  - interested candidate exposes saved draft from action state.

Source/API tests:

- `api-route-copy.test.mjs`
  - Role Workspace renders `Save scheduling draft`, saved draft copy, and uses saved/generated draft before marking interview-ready.
  - No send route or Calendar event route is called.

Verification:

- `node --test inbox-actions.test.mjs inbox-agent.test.mjs api-route-copy.test.mjs calendar-availability.test.mjs`
- `npm --prefix web run build`
- Two independent agents:
  - Product function acceptance.
  - UX and safety acceptance.
