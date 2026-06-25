import { getProject } from "@/lib/projects";
import { addItem } from "@/lib/shortlist";
import { miraProfilesToShortlistCandidates, searchMiraPeople } from "@/lib/openjobs-provider.mjs";
import { runOpenJobsProviderSearch } from "@/lib/openjobs-route.mjs";
import { normalizeLocale, t } from "@/lib/i18n.mjs";
import { getUser } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: { project_id?: unknown; brief?: unknown; limit?: unknown; locale?: unknown } = {};
  try { body = await req.json(); } catch {}
  const locale = normalizeLocale(body.locale);
  const user = await getUser();
  const result = await runOpenJobsProviderSearch({
    body,
    user,
    getProject,
    searchMiraPeople,
    toShortlistCandidates: miraProfilesToShortlistCandidates,
    addItem,
    messages: {
      loginRequired: t(locale, "api.error.loginRequired"),
      missingId: t(locale, "api.error.missingId"),
      projectNotFound: t(locale, "api.error.projectNotFound"),
    },
  });
  return Response.json(result.body, { status: result.status });
}
