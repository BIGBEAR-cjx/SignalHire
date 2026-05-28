import { workerHealth } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const health = await workerHealth();
  return Response.json(health, { status: health.ok ? 200 : 503 });
}
