import { runBulkContactResolution } from "@/lib/contact-resolution-route.mjs";
import { listOutreachThreads, updateOutreachThread } from "@/lib/outreach-threads";
import { normalizeLocale, t } from "@/lib/i18n.mjs";
import { getUser } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: { project_id?: unknown; force_refresh?: unknown; locale?: unknown } = {};
  try { body = await req.json(); } catch {}
  const locale = normalizeLocale(body.locale);
  const user = await getUser();
  const result = await runBulkContactResolution({
    body,
    user,
    env: process.env,
    listOutreachThreads,
    updateOutreachThread,
    messages: {
      loginRequired: t(locale, "api.error.loginRequired"),
      missingId: t(locale, "api.error.missingId"),
    },
  });
  return Response.json(result.body, { status: result.status });
}
