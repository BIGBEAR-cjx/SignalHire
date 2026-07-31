import { createClient } from "@insforge/sdk";
import { authorizeOpsUser } from "../../../../../lib/ops-auth";
import { createOpsFailedReservationsHandler, terminalMonitorFailureReason } from "../../../../../lib/ops-credits-handlers.mjs";
import { getUser } from "../../../../../lib/session";

export const runtime = "nodejs";

type FailedReservation = {
  id: string;
  userId: string;
  email: string | null;
  runId: string;
  taskId: string;
  status: "released";
  amount: number;
  updatedAt: string;
  failureReason: "monitor_run_failed" | "monitor_run_cancelled";
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BASE = process.env.INSFORGE_API_BASE_URL;
const SERVICE_ROLE_KEY = process.env.INSFORGE_CREDITS_SERVICE_ROLE_KEY;
const client = BASE && SERVICE_ROLE_KEY
  ? createClient({ baseUrl: BASE, anonKey: SERVICE_ROLE_KEY, isServerMode: true })
  : null;

function asUuid(value: unknown) {
  const id = typeof value === "string" ? value.trim() : "";
  return UUID_PATTERN.test(id) ? id : null;
}

function asEmail(value: unknown) {
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  return EMAIL_PATTERN.test(email) ? email : null;
}

function asPositiveInteger(value: unknown) {
  return Number.isInteger(value) && Number(value) > 0 ? Number(value) : null;
}

function asTimestamp(value: unknown) {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) ? value : null;
}

async function configuredListFailedReservations(): Promise<FailedReservation[]> {
  if (!client) throw new Error("Credits service-role lookup is not configured");
  const { data: taskRows, error: taskError } = await client.database
    .from("search_task_runs")
    .select("credit_reservation_id,search_task_id,status")
    .in("status", ["failed", "cancelled"])
    .order("updated_at", { ascending: false })
    .limit(50);
  if (taskError || !Array.isArray(taskRows)) throw new Error("Failed monitor-run lookup failed");

  const terminalRuns = taskRows.map((row) => {
    const reservationId = asUuid(row?.credit_reservation_id);
    const taskId = asUuid(row?.search_task_id);
    const failureReason = terminalMonitorFailureReason(row?.status) as FailedReservation["failureReason"] | null;
    if (!reservationId || !taskId || !failureReason) throw new Error("Malformed terminal monitor-run reservation link");
    return { reservationId, taskId, failureReason };
  });
  if (terminalRuns.length === 0) return [];

  const { data: reservationRows, error: reservationError } = await client.database
    .from("credit_reservations")
    .select("id,user_id,run_id,reserved_amount,status,updated_at")
    .in("id", terminalRuns.map((run) => run.reservationId))
    .eq("status", "released");
  if (reservationError || !Array.isArray(reservationRows)) throw new Error("Failed reservation lookup failed");

  const reservations = reservationRows.map((row) => {
    const id = asUuid(row?.id);
    const userId = asUuid(row?.user_id);
    const runId = asUuid(row?.run_id);
    const amount = asPositiveInteger(row?.reserved_amount);
    const updatedAt = asTimestamp(row?.updated_at);
    if (!id || !userId || !runId || amount === null || !updatedAt || row?.status !== "released") throw new Error("Malformed failed reservation row");
    return { id, userId, runId, amount, updatedAt };
  });
  if (reservations.length === 0) return [];

  const { data: labelRows, error: labelError } = await client.database
    .from("ops_credit_identity_labels")
    .select("user_id,email")
    .in("user_id", reservations.map((reservation) => reservation.userId));
  if (labelError || !Array.isArray(labelRows)) throw new Error("Failed reservation identity lookup failed");

  const emails = new Map<string, string>();
  for (const row of labelRows) {
    const userId = asUuid(row?.user_id);
    const email = asEmail(row?.email);
    if (!userId || !email) throw new Error("Malformed operator-recorded identity label");
    emails.set(userId, email);
  }
  const reservationsById = new Map(reservations.map((reservation) => [reservation.id, reservation]));
  return terminalRuns.flatMap((run) => {
    const reservation = reservationsById.get(run.reservationId);
    if (!reservation) return [];
    return [{
      ...reservation,
      email: emails.get(reservation.userId) ?? null,
      taskId: run.taskId,
      status: "released" as const,
      failureReason: run.failureReason,
    }];
  });
}

export const GET = createOpsFailedReservationsHandler({
  getUser,
  configuredEmail: process.env.OPS_ADMIN_EMAIL,
  authorizeUser: authorizeOpsUser,
  listFailedReservations: configuredListFailedReservations,
});
