# Autonomous Recruiter P3a: Calendar Availability Scheduling Draft

## 1. Summary

P2d already turns interested replies into a human-reviewed scheduling handoff. P3a adds the next missing autonomous recruiter capability: use Google Calendar free/busy availability to generate a more useful scheduling draft for interested candidates.

This phase stays human-in-loop. SignalHire can read availability and draft suggested windows, but it does not create calendar events, send calendar invites, or auto-send candidate emails.

## 2. Problem

The current interested candidate flow asks candidates for 2-3 time windows. That is safe, but still makes the recruiter coordinate manually. Users who want “少管 inbox，直接拿面试” need SignalHire to bring real availability into the scheduling handoff before a human approves the next message.

## 3. Goals

- Extend the existing Google OAuth connection to request Calendar free/busy access.
- Show whether the connected Google account has calendar availability access.
- Add a server-side availability builder that converts busy calendar blocks into 2-3 suggested interview windows.
- Let Role Workspace generate a calendar-aware scheduling draft for an interested candidate.
- Keep the draft copyable and user-approved; no automatic invite or send.

## 4. Non-Goals

- No automatic Google Calendar event creation.
- No automatic calendar invite sending.
- No automatic candidate email sending.
- No role-level approval rules.
- No multi-interviewer scheduling optimization.
- No ATS integration.
- No candidate self-scheduling page.

## 5. Product Behavior

### Google Connection

- Existing `/api/integrations/gmail/connect` remains the connection entry point, but it should request:
  - `gmail.send`
  - `gmail.readonly`
  - `calendar.freebusy`
- Existing Gmail status adds `can_read_calendar`.
- If calendar scope is missing, Role Workspace shows a reconnect CTA near the interested candidate scheduling flow.

### Availability Draft

- New server route generates scheduling availability for the authenticated user.
- The first version checks the primary calendar for a near-term window, converts busy blocks into open 30-minute slots, and returns 2-3 suggested slots.
- Interested Candidate Queue can generate a calendar-aware draft from an interested candidate’s `scheduling_packet`.
- Generated draft includes:
  - candidate name
  - role context from existing packet
  - 2-3 suggested windows if available
  - fallback language if calendar access is missing or no slots are found
- Draft remains copyable; the user still clicks `Mark interview-ready` separately.

## 6. Safety And Privacy

- Calendar tokens stay server-side.
- Calendar API errors return reason codes, not token details.
- Availability route must require auth.
- Availability route must not expose raw calendar event titles, attendees, locations, or descriptions.
- UI must say no invite or email is sent automatically.

## 7. Acceptance Criteria

- Google OAuth URL includes `calendar.freebusy`.
- Gmail status reports `can_read_calendar`.
- Calendar availability helper returns 2-3 open slots from free/busy response.
- Calendar availability helper never returns raw event metadata.
- Role Workspace renders calendar-aware scheduling draft controls for interested candidates.
- Missing calendar scope disables generation and shows reconnect guidance.
- Generated draft can be copied and does not imply an invite was created or sent.

## 8. Test Plan

Unit tests:

- OAuth scope includes `calendar.freebusy`.
- Status derives `can_read_calendar` from stored scope.
- Availability request uses Google Calendar freeBusy endpoint shape.
- Busy blocks are converted into bounded open slots.
- Scheduling draft includes suggested windows and safety language.

Source/API tests:

- Calendar availability route exists, requires `getUser`, and does not expose token env vars.
- Role Workspace renders calendar scheduling controls, reconnect CTA, and no-auto-send copy.

Verification:

- `node --test gmail-outreach.test.mjs calendar-availability.test.mjs api-route-copy.test.mjs`
- Relevant inbox tests if action payload changes.
- `npm --prefix web run build`
- Two independent agents:
  - Product function acceptance.
  - UX and privacy acceptance.
