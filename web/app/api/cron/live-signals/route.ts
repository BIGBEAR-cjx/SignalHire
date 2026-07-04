import { refreshDueLiveSignals } from "@/lib/live-signal-refresh";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const result = await refreshDueLiveSignals(10);
  return Response.json(result);
}
