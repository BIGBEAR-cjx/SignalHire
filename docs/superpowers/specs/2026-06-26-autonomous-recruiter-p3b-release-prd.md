# Autonomous Recruiter P3b Release PRD: Persistent Scheduling Draft State

## Summary

P3b releases persistent scheduling draft state for the Inbox Agent scheduling flow. Recruiters can generate a calendar-aware scheduling draft, save it to the existing outreach thread action metadata, refresh the Role Workspace, and later mark the same candidate interview-ready with the saved draft preserved.

This is a state-persistence release only. It does not send email, create calendar events, create calendar invites, or automate scheduling.

## User Outcome

- A recruiter can generate a scheduling draft from calendar availability.
- The recruiter can save the draft before deciding that the candidate is interview-ready.
- The interested candidate remains in the needs-scheduling queue until the recruiter explicitly marks interview-ready.
- The saved draft is visible and copyable after reload.
- Marking interview-ready uses the generated or saved scheduling draft before falling back to the generic scheduling packet.

## Scope

- Add `save_scheduling_draft` to inbox action metadata.
- Persist `scheduling_message` with `action_status: "draft_saved"`.
- Keep saved scheduling drafts in the interested candidate queue.
- Render saved scheduling draft copy in Role Workspace.
- Add a save control next to the calendar-aware scheduling draft.
- Preserve the explicit `Mark interview-ready` handoff action.

## Non-Goals

- No automatic email send.
- No calendar event creation.
- No calendar invite creation.
- No Gmail inbox classification changes.
- No schema migration.
- No external scheduling provider integration.

## Acceptance

- `save_scheduling_draft` persists the scheduling message without changing the thread to interview-ready.
- A saved scheduling draft remains visible in `interested_candidates`.
- The Role Workspace shows `Save scheduling draft`, `Saved scheduling draft`, and the matching Chinese labels.
- The Role Workspace states that saving the draft does not send email or create a calendar invite.
- A later `schedule` action can promote the same thread to `interview_ready`.
- Tests and frontend build pass before deployment.
