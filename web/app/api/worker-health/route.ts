import { workerHealth } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const health = await workerHealth();
  return Response.json(
    {
      ok: health.ok,
      checked_at: health.checked_at,
      stale_after_ms: health.stale_after_ms,
      reason: health.reason,
      queue: health.queue,
      stale_count: health.stale_jobs.length,
      recent_done_at: health.recent_done?.finished_at ?? health.recent_done?.updated_at ?? null,
    },
    { status: health.ok ? 200 : 503 },
  );
}
