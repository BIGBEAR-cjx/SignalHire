import { runRoleAgentProjectAction, type RoleAgentRunAction } from "@/lib/role-agent-runner";
import { normalizeLocale, t } from "@/lib/i18n.mjs";
import { getUser } from "@/lib/session";

export const runtime = "nodejs";

const ACTIONS = new Set<RoleAgentRunAction>(["run_sourcing", "refresh_live_signals"]);

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  let body: { action_type?: unknown; locale?: unknown } = {};
  try { body = await req.json(); } catch {}
  const locale = normalizeLocale(body.locale);
  const user = await getUser();
  if (!user) return Response.json({ error: t(locale, "api.error.loginRequired") }, { status: 401 });
  const { id } = await ctx.params;
  const actionType = typeof body.action_type === "string" && ACTIONS.has(body.action_type as RoleAgentRunAction)
    ? body.action_type as RoleAgentRunAction
    : null;
  if (!id || !actionType) return Response.json({ error: t(locale, "api.error.missingId") }, { status: 400 });
  const result = await runRoleAgentProjectAction({ userId: user.id, projectId: id, actionType });
  if (!result) return Response.json({ error: t(locale, "api.error.projectUpdateUnavailable") }, { status: 404 });
  return Response.json({ run: result });
}
