import test from "node:test";
import assert from "node:assert/strict";
import {
  GOOGLE_CALENDAR_EVENTS_SCOPE,
  buildCalendarEventDeleteRequest,
  buildCalendarEventInsertRequest,
  buildCalendarEventPatchRequest,
  buildCalendarFreeBusyRequest,
  buildCalendarSchedulingDraft,
  calendarScopeStatus,
  slotsFromFreeBusy,
} from "./web/lib/calendar-availability.mjs";

test("calendar scope status detects freebusy access without accepting unrelated scopes", () => {
  assert.deepEqual(calendarScopeStatus("https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/calendar.freebusy https://www.googleapis.com/auth/calendar.events"), {
    can_read_calendar: true,
    can_create_calendar_event: true,
    missing_reason: "",
  });
  assert.deepEqual(calendarScopeStatus("https://www.googleapis.com/auth/gmail.send"), {
    can_read_calendar: false,
    can_create_calendar_event: false,
    missing_reason: "calendar_scope_missing",
  });
  assert.equal(calendarScopeStatus("https://www.googleapis.com/auth/calendar.freebusy").can_create_calendar_event, false);
  assert.equal(GOOGLE_CALENDAR_EVENTS_SCOPE, "https://www.googleapis.com/auth/calendar.events");
});

test("calendar freebusy request uses Google freeBusy endpoint and hides event metadata", () => {
  const request = buildCalendarFreeBusyRequest({
    accessToken: "access-1",
    timeMin: "2026-06-29T09:00:00.000Z",
    timeMax: "2026-06-29T13:00:00.000Z",
  });

  assert.equal(request.url, "https://www.googleapis.com/calendar/v3/freeBusy");
  assert.equal(request.method, "POST");
  assert.equal(request.headers.Authorization, "Bearer access-1");
  assert.deepEqual(JSON.parse(request.body), {
    timeMin: "2026-06-29T09:00:00.000Z",
    timeMax: "2026-06-29T13:00:00.000Z",
    items: [{ id: "primary" }],
  });
  assert.doesNotMatch(request.body, /summary|attendees|location|description/);
});

test("freebusy response becomes bounded open interview slots", () => {
  const slots = slotsFromFreeBusy({
    response: {
      calendars: {
        primary: {
          busy: [
            {
              start: "2026-06-29T10:00:00.000Z",
              end: "2026-06-29T10:30:00.000Z",
              summary: "Private event title",
              attendees: [{ email: "person@example.com" }],
              location: "Private room",
              description: "Private notes",
            },
            { start: "2026-06-29T12:00:00.000Z", end: "2026-06-29T12:30:00.000Z" },
          ],
        },
      },
    },
    timeMin: "2026-06-29T09:00:00.000Z",
    timeMax: "2026-06-29T13:00:00.000Z",
    durationMinutes: 30,
    maxSlots: 3,
    locale: "en",
  });

  assert.deepEqual(slots.map((slot) => [slot.start, slot.end]), [
    ["2026-06-29T09:00:00.000Z", "2026-06-29T09:30:00.000Z"],
    ["2026-06-29T09:30:00.000Z", "2026-06-29T10:00:00.000Z"],
    ["2026-06-29T10:30:00.000Z", "2026-06-29T11:00:00.000Z"],
  ]);
  assert.equal(slots.length, 3);
  assert.match(slots[0].label, /Jun|2026|9:00/);
  for (const slot of slots) {
    assert.deepEqual(Object.keys(slot).sort(), ["end", "label", "start"]);
  }
  assert.doesNotMatch(JSON.stringify(slots), /Private event title|person@example\.com|Private room|Private notes/);
});

test("calendar scheduling draft includes candidate context, slots, and no-invite safety copy", () => {
  const draft = buildCalendarSchedulingDraft({
    locale: "en",
    candidateName: "Ada",
    packet: {
      candidate_summary: "Ada replied with interest.",
      candidate_reply: "Happy to chat next week.",
    },
    slots: [
      { start: "2026-06-29T09:00:00.000Z", end: "2026-06-29T09:30:00.000Z", label: "Jun 29, 9:00 AM" },
      { start: "2026-06-29T09:30:00.000Z", end: "2026-06-29T10:00:00.000Z", label: "Jun 29, 9:30 AM" },
    ],
  });

  assert.match(draft.subject, /Ada/);
  assert.match(draft.body, /Happy to chat next week/);
  assert.match(draft.body, /Jun 29, 9:00 AM/);
  assert.match(draft.body, /No calendar invite or email has been sent/);
  assert.doesNotMatch(draft.body, /already scheduled|invite created/i);
});

test("calendar event insert request creates an interview event with attendees and sendUpdates", () => {
  const request = buildCalendarEventInsertRequest({
    accessToken: "access-1",
    candidateName: "Ada",
    candidateEmail: "ada@example.ai",
    calendarSlot: {
      start: "2026-07-05T16:00:00.000Z",
      end: "2026-07-05T16:30:00.000Z",
      label: "Jul 5, 4:00 PM",
    },
    description: "Confirmed from SignalHire.",
  });

  assert.equal(request.url, "https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all");
  assert.equal(request.method, "POST");
  assert.equal(request.headers.Authorization, "Bearer access-1");
  const body = JSON.parse(request.body);
  assert.equal(body.summary, "Interview: Ada");
  assert.deepEqual(body.start, { dateTime: "2026-07-05T16:00:00.000Z" });
  assert.deepEqual(body.end, { dateTime: "2026-07-05T16:30:00.000Z" });
  assert.deepEqual(body.attendees, [{ email: "ada@example.ai" }]);
  assert.equal(body.extendedProperties.private.source, "signalhire");
});

test("calendar event patch request reschedules an interview event with sendUpdates", () => {
  const request = buildCalendarEventPatchRequest({
    accessToken: "access-1",
    calendarEventId: "evt-123",
    calendarSlot: {
      start: "2026-07-06T16:00:00.000Z",
      end: "2026-07-06T16:30:00.000Z",
      label: "Jul 6, 4:00 PM",
    },
    description: "Rescheduled from SignalHire.",
  });

  assert.equal(request.url, "https://www.googleapis.com/calendar/v3/calendars/primary/events/evt-123?sendUpdates=all");
  assert.equal(request.method, "PATCH");
  assert.equal(request.headers.Authorization, "Bearer access-1");
  assert.deepEqual(JSON.parse(request.body), {
    description: "Rescheduled from SignalHire.",
    start: { dateTime: "2026-07-06T16:00:00.000Z" },
    end: { dateTime: "2026-07-06T16:30:00.000Z" },
  });
});

test("calendar event delete request cancels an interview event with attendee updates", () => {
  const request = buildCalendarEventDeleteRequest({
    accessToken: "access-1",
    calendarEventId: "evt-123",
  });

  assert.equal(request.url, "https://www.googleapis.com/calendar/v3/calendars/primary/events/evt-123?sendUpdates=all");
  assert.equal(request.method, "DELETE");
  assert.equal(request.headers.Authorization, "Bearer access-1");
  assert.equal("body" in request, false);
});
