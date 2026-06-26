import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCalendarFreeBusyRequest,
  buildCalendarSchedulingDraft,
  calendarScopeStatus,
  slotsFromFreeBusy,
} from "./web/lib/calendar-availability.mjs";

test("calendar scope status detects freebusy access without accepting unrelated scopes", () => {
  assert.deepEqual(calendarScopeStatus("https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/calendar.freebusy"), {
    can_read_calendar: true,
    missing_reason: "",
  });
  assert.deepEqual(calendarScopeStatus("https://www.googleapis.com/auth/gmail.send"), {
    can_read_calendar: false,
    missing_reason: "calendar_scope_missing",
  });
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
