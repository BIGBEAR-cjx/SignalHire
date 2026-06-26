import { getOutreachThread, updateOutreachThread } from "@/lib/outreach-threads";
import { runInboxAction } from "@/lib/inbox-actions-route.mjs";
import { getUser } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch {}
  const user = await getUser();
  const result = await runInboxAction({
    body,
    user,
    getOutreachThread,
    updateOutreachThread,
  });
  return Response.json(result.body, { status: result.status });
}
