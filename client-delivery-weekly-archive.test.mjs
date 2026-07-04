import test from "node:test";
import assert from "node:assert/strict";
import { buildClientDeliveryWeeklyArchiveFromRows, buildClientDeliveryWeeklyArchiveRow } from "./web/lib/client-delivery-weekly-archive.mjs";

test("builds a persistent weekly archive row from a client delivery archive item", () => {
  const row = buildClientDeliveryWeeklyArchiveRow({
    userId: "user-1",
    projectId: "project-1",
    item: {
      archive_id: "cda_week_1",
      week_start: "2026-06-29",
      week_end: "2026-07-05",
      label: "Week of Jun 29",
      latest_report_id: "run-week-2b",
      latest_snapshot_id: "cds_snapshot_2b",
      metrics: { new_candidates: 4, contacted: 3, replied: 2, interview_ready: 1, confirmed: 1 },
      risks: ["One candidate needs compensation alignment."],
      next_actions: ["Share confirmed interview with client."],
      reports: [
        {
          id: "run-week-2b",
          label: "Week 2 delivery follow-up",
          summary: "Added one confirmed interview.",
          delivered_at: "2026-07-03T08:00:00.000Z",
          href: "/r/run-week-2b?lang=en&t=token-2b",
          snapshot_id: "cds_snapshot_2b",
          candidate_count: 1,
        },
      ],
    },
  });

  assert.deepEqual(row, {
    user_id: "user-1",
    project_id: "project-1",
    archive_id: "cda_week_1",
    week_start: "2026-06-29",
    week_end: "2026-07-05",
    label: "Week of Jun 29",
    latest_report_id: "run-week-2b",
    latest_snapshot_id: "cds_snapshot_2b",
    metrics: { new_candidates: 4, contacted: 3, replied: 2, interview_ready: 1, confirmed: 1 },
    risks: ["One candidate needs compensation alignment."],
    next_actions: ["Share confirmed interview with client."],
    reports: [
      {
        id: "run-week-2b",
        label: "Week 2 delivery follow-up",
        summary: "Added one confirmed interview.",
        delivered_at: "2026-07-03T08:00:00.000Z",
        href: "/r/run-week-2b?lang=en&t=token-2b",
        snapshot_id: "cds_snapshot_2b",
        candidate_count: 1,
      },
    ],
    latest_report_at: "2026-07-03T08:00:00.000Z",
  });
});

test("rejects invalid or empty weekly archive rows", () => {
  assert.equal(buildClientDeliveryWeeklyArchiveRow({
    userId: "user-1",
    projectId: "project-1",
    item: { archive_id: "", week_start: "2026-06-29" },
  }), null);
  assert.equal(buildClientDeliveryWeeklyArchiveRow({
    userId: "",
    projectId: "project-1",
    item: { archive_id: "cda_week_1", week_start: "2026-06-29", week_end: "2026-07-05" },
  }), null);
});

test("builds weekly archive view from persisted rows", () => {
  const archive = buildClientDeliveryWeeklyArchiveFromRows([
    {
      user_id: "user-1",
      project_id: "project-1",
      archive_id: "cda_week_1",
      week_start: "2026-06-29",
      week_end: "2026-07-05",
      label: "Week of Jun 29",
      latest_report_id: "run-week-2b",
      latest_snapshot_id: "cds_snapshot_2b",
      metrics: { new_candidates: 4, contacted: 3, replied: 2, interview_ready: 1, confirmed: 1 },
      risks: ["One candidate needs compensation alignment."],
      next_actions: ["Share confirmed interview with client."],
      reports: [
        {
          id: "run-week-2b",
          label: "Week 2 delivery follow-up",
          summary: "Added one confirmed interview.",
          delivered_at: "2026-07-03T08:00:00.000Z",
          href: "/r/run-week-2b?lang=en&t=token-2b",
          snapshot_id: "cds_snapshot_2b",
          candidate_count: 1,
        },
      ],
      latest_report_at: "2026-07-03T08:00:00.000Z",
    },
  ], { locale: "en" });

  assert.equal(archive.title, "Weekly delivery archive");
  assert.equal(archive.items.length, 1);
  assert.equal(archive.items[0].archive_id, "cda_week_1");
  assert.equal(archive.items[0].latest_report_id, "run-week-2b");
  assert.deepEqual(archive.items[0].metrics, { new_candidates: 4, contacted: 3, replied: 2, interview_ready: 1, confirmed: 1 });
  assert.equal(archive.items[0].reports[0].href, "/r/run-week-2b?lang=en&t=token-2b");
});
