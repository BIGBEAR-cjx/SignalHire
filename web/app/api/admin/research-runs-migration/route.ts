import { createHash, timingSafeEqual } from "node:crypto";

export const runtime = "nodejs";

const TOKEN_SHA256 = "06dc996ebd2f202ac45df853e954d8641d0cb6f4435db42b9f2018cbae929321";
const MIGRATION_VERSION = "20260528090000";
const MIGRATION_NAME = "research-runs-job-reliability-v1";
const MIGRATION_SQL = `
alter table public.research_runs
  add column if not exists status text not null default 'done',
  add column if not exists progress jsonb,
  add column if not exists error text,
  add column if not exists last_error text,
  add column if not exists attempt_count integer not null default 0,
  add column if not exists max_attempts integer not null default 3,
  add column if not exists locked_at timestamptz,
  add column if not exists started_at timestamptz,
  add column if not exists finished_at timestamptz;

update public.research_runs
set
  status = coalesce(status, 'done'),
  attempt_count = coalesce(attempt_count, 0),
  max_attempts = coalesce(max_attempts, 3);
`;

function authorized(req: Request) {
  const token = req.headers.get("x-vercel-protection-bypass") || "";
  const hash = createHash("sha256").update(token).digest("hex");
  return timingSafeEqual(Buffer.from(hash), Buffer.from(TOKEN_SHA256));
}

export async function POST(req: Request) {
  if (!authorized(req)) return Response.json({ error: "not found" }, { status: 404 });

  const baseUrl = process.env.INSFORGE_API_BASE_URL;
  const apiKey = process.env.INSFORGE_API_KEY;
  if (!baseUrl || !apiKey) {
    return Response.json({ error: "missing Insforge env" }, { status: 500 });
  }

  const res = await fetch(new URL("/api/database/migrations", baseUrl), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: MIGRATION_NAME,
      version: MIGRATION_VERSION,
      sql: MIGRATION_SQL,
    }),
  });

  const text = await res.text();
  let body: unknown = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {}

  return Response.json({ ok: res.ok, status: res.status, body }, { status: res.ok ? 200 : 502 });
}
