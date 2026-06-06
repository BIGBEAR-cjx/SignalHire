// /api/shortlist/[id]
//   PATCH { status?, notes?, candidate? } → 改状态/备注/候选人快照
//   DELETE → 移出候选池
import { deleteItem, updateItem, STATUSES, type ShortlistStatus } from "@/lib/shortlist";
import { normalizeLocale, t } from "@/lib/i18n.mjs";
import { getUser } from "@/lib/session";

export const runtime = "nodejs";

function isStatus(s: unknown): s is ShortlistStatus {
  return typeof s === "string" && (STATUSES as string[]).includes(s);
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  let body: { status?: unknown; notes?: unknown; project_id?: unknown; candidate?: unknown; locale?: unknown } = {};
  try { body = await req.json(); } catch {}
  const locale = normalizeLocale(body.locale);

  const user = await getUser();
  if (!user) return Response.json({ error: t(locale, "api.error.loginRequired") }, { status: 401 });
  const { id } = await ctx.params;
  if (!id) return Response.json({ error: t(locale, "api.error.missingId") }, { status: 400 });

  const patch: { status?: ShortlistStatus; notes?: string | null; projectId?: string | null; candidate?: unknown } = {};
  if (body.status !== undefined) {
    if (!isStatus(body.status)) return Response.json({ error: t(locale, "api.error.invalidStatus") }, { status: 400 });
    patch.status = body.status;
  }
  if (body.notes !== undefined) {
    if (body.notes !== null && typeof body.notes !== "string") return Response.json({ error: t(locale, "api.error.invalidNotes") }, { status: 400 });
    patch.notes = body.notes as string | null;
  }
  if (body.project_id !== undefined) {
    if (body.project_id !== null && typeof body.project_id !== "string") return Response.json({ error: t(locale, "api.error.invalidProjectId") }, { status: 400 });
    patch.projectId = body.project_id as string | null;
  }
  if (body.candidate !== undefined) {
    if (body.candidate === null || typeof body.candidate !== "object" || Array.isArray(body.candidate)) {
      return Response.json({ error: t(locale, "api.error.invalidCandidateObject") }, { status: 400 });
    }
    patch.candidate = body.candidate;
  }
  if (patch.status === undefined && patch.notes === undefined && patch.projectId === undefined && patch.candidate === undefined) {
    return Response.json({ error: t(locale, "api.error.emptyPatch") }, { status: 400 });
  }

  const ok = await updateItem({ userId: user.id, id, ...patch });
  if (!ok) return Response.json({ error: t(locale, "api.error.shortlistUpdateUnavailable") }, { status: 404 });
  return Response.json({ ok: true });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const locale = normalizeLocale(new URL(req.url).searchParams.get("locale"));
  const user = await getUser();
  if (!user) return Response.json({ error: t(locale, "api.error.loginRequired") }, { status: 401 });
  const { id } = await ctx.params;
  if (!id) return Response.json({ error: t(locale, "api.error.missingId") }, { status: 400 });

  const ok = await deleteItem(user.id, id);
  if (!ok) return Response.json({ error: t(locale, "api.error.shortlistItemDeleteUnavailable") }, { status: 404 });
  return Response.json({ ok: true });
}
