import { recordProjectRoleAgentEvent } from "@/lib/projects";
import { normalizeLocale, t } from "@/lib/i18n.mjs";
import { getUser } from "@/lib/session";

export const runtime = "nodejs";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  let body: {
    event_type?: unknown;
    action_type?: unknown;
    action_status?: unknown;
    run_id?: unknown;
    workflow_step?: unknown;
    guardrail?: unknown;
    detail?: unknown;
    targets?: unknown;
    result?: unknown;
    failed_items?: unknown;
    retryable?: unknown;
    at?: unknown;
    locale?: unknown;
  } = {};
  try { body = await req.json(); } catch {}
  const locale = normalizeLocale(body.locale);
  const user = await getUser();
  if (!user) return Response.json({ error: t(locale, "api.error.loginRequired") }, { status: 401 });
  const { id } = await ctx.params;
  if (!id) return Response.json({ error: t(locale, "api.error.missingId") }, { status: 400 });

  const metrics = await recordProjectRoleAgentEvent({
    userId: user.id,
    id,
    event: {
      event_type: typeof body.event_type === "string" ? body.event_type : undefined,
      action_type: typeof body.action_type === "string" ? body.action_type : undefined,
      action_status: typeof body.action_status === "string" ? body.action_status : undefined,
      run_id: typeof body.run_id === "string" ? body.run_id : undefined,
      workflow_step: typeof body.workflow_step === "string" ? body.workflow_step : undefined,
      guardrail: typeof body.guardrail === "string" ? body.guardrail : undefined,
      detail: typeof body.detail === "string" ? body.detail : undefined,
      targets: Array.isArray(body.targets) ? body.targets : undefined,
      result: isRecord(body.result) ? body.result as Record<string, string | number | boolean> : undefined,
      failed_items: Array.isArray(body.failed_items) ? body.failed_items : undefined,
      retryable: typeof body.retryable === "boolean" ? body.retryable : undefined,
      at: typeof body.at === "string" ? body.at : undefined,
    },
  });
  if (!metrics) return Response.json({ error: t(locale, "api.error.projectUpdateUnavailable") }, { status: 404 });
  return Response.json({ metrics });
}
