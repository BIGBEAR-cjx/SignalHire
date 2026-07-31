import { authorizeOpsUser } from "../../../lib/ops-auth.ts";
import { getUser } from "../../../lib/session.ts";

export const runtime = "nodejs";

export async function GET() {
  const authorization = authorizeOpsUser(await getUser());
  if (authorization.status !== 200) {
    return Response.json({ error: authorization.status === 401 ? "login_required" : "forbidden" }, {
      status: authorization.status,
    });
  }
  return Response.json({ user: authorization.user });
}
