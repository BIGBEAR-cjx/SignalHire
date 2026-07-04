import { buildClientDeliveryAuditCenterCsv, buildClientDeliveryAuditCenterView } from "@/lib/client-delivery-audit-center.mjs";
import { normalizeLocale, t } from "@/lib/i18n.mjs";
import {
  listProjects,
  listUserClientDeliveryAuditEvents,
  listUserClientDeliveryWeeklyArchives,
} from "@/lib/projects";
import { getUser } from "@/lib/session";

export const runtime = "nodejs";

function filtersFromUrl(url: URL) {
  const project = url.searchParams.get("project") || "all";
  return {
    project,
    range: url.searchParams.get("range") || "30d",
    type: url.searchParams.get("type") || "all",
  };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const locale = normalizeLocale(url.searchParams.get("locale"));
  const user = await getUser();
  if (!user) return Response.json({ error: t(locale, "api.error.loginRequired") }, { status: 401 });

  const filters = filtersFromUrl(url);
  const projectId = filters.project !== "all" ? filters.project : undefined;
  const [projects, events, weeklyArchives] = await Promise.all([
    listProjects(user.id),
    listUserClientDeliveryAuditEvents({ userId: user.id, projectId, limit: 500 }),
    listUserClientDeliveryWeeklyArchives({ userId: user.id, projectId, limit: 500 }),
  ]);
  const view = buildClientDeliveryAuditCenterView({
    projects: projects.map((project) => ({ id: project.id, name: project.name })),
    events,
    weeklyArchives,
    filters,
    locale,
  });

  return new Response(buildClientDeliveryAuditCenterCsv(view), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="client-delivery-audit-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
