import { buildAtsCandidateExportPayload, buildAtsLiteProviderStatus } from "@/lib/ats-lite.mjs";
import { getItem } from "@/lib/shortlist";
import { normalizeLocale, t } from "@/lib/i18n.mjs";
import { getUser } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: { shortlist_item_id?: unknown; report_base_url?: unknown; locale?: unknown } = {};
  try { body = await req.json(); } catch {}
  const locale = normalizeLocale(body.locale);
  const user = await getUser();
  if (!user) return Response.json({ error: t(locale, "api.error.loginRequired") }, { status: 401 });

  const itemId = typeof body.shortlist_item_id === "string" ? body.shortlist_item_id : "";
  if (!itemId) return Response.json({ error: t(locale, "api.error.missingId") }, { status: 400 });
  const item = await getItem(user.id, itemId);
  if (!item) return Response.json({ error: t(locale, "api.error.shortlistUpdateUnavailable") }, { status: 404 });

  const preview = buildAtsCandidateExportPayload({
    projectId: item.project_id ?? "",
    candidateId: item.id,
    status: item.status,
    candidate: item.candidate,
    reportBaseUrl: typeof body.report_base_url === "string" ? body.report_base_url : "",
  });
  if (!preview.ok) return Response.json({ error: preview.reason }, { status: 400 });
  return Response.json({
    provider: buildAtsLiteProviderStatus(),
    export_preview: preview.payload,
    dedupe_keys: preview.dedupe_keys,
    exported: false,
  });
}
