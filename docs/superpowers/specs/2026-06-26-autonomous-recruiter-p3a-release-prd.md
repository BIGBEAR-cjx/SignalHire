# Autonomous Recruiter P3a Release PRD: Calendar Availability Scheduling Draft

## 1. Release Scope

P3a adds Calendar availability support to the interested candidate scheduling flow. It extends the existing Google connection, adds a server-side free/busy availability route, and lets Role Workspace generate a recruiter-reviewed scheduling draft with suggested windows.

## 2. Included Changes

- Google OAuth now requests `calendar.freebusy` in addition to Gmail send/read scopes.
- Google connection status includes `can_read_calendar`.
- New Calendar availability helper:
  - builds Google freeBusy requests
  - converts busy blocks into bounded interview slots
  - generates candidate scheduling draft copy
- New route: `POST /api/integrations/calendar/availability`.
- Interested Candidate Queue adds:
  - `Generate scheduling draft`
  - `Reconnect Google Calendar`
  - copyable calendar-aware draft
  - explicit no-auto-invite/no-auto-email safety copy

## 3. Safety Boundaries

- No calendar event is created.
- No calendar invite is sent.
- No candidate email is sent.
- Raw calendar event titles, attendees, locations, and descriptions are not returned.
- Calendar tokens remain server-side.
- Missing calendar scope shows reconnect guidance.

## 4. Verification

- `node --test gmail-outreach.test.mjs calendar-availability.test.mjs inbox-agent.test.mjs inbox-actions.test.mjs inbox-sync-core.test.mjs inbox-background-sync.test.mjs api-route-copy.test.mjs`
- `npm --prefix web run build`
- Two independent acceptance agents:
  - Product function acceptance.
  - UX and privacy acceptance.

## 5. Known Residual Risks

- Availability currently uses primary calendar and simple bounded slots.
- No multi-interviewer or hiring-manager calendar merge yet.
- No calendar event creation or role-level approval rule yet.
- Existing connected users must reconnect Google to grant the new `calendar.freebusy` scope.
