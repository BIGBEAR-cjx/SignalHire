import { enqueueDueSearchTasks } from "@/lib/search-tasks";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const result = await enqueueDueSearchTasks(10);
  return Response.json(result);
}
