import { backgroundInboxSync } from "@/lib/inbox-background-sync";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const result = await backgroundInboxSync({ maxProjects: 10, maxThreadsPerProject: 20 });
  return Response.json(result, { status: result.ok ? 200 : 207 });
}
