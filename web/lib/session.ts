// lib/session.ts —— 服务端读取当前登录用户 (从 sh_token cookie)。
//
// 流程:
//   1. 读 sh_token httpOnly cookie (登录时由 /api/auth/session 写入)
//   2. 用 Bearer token 调 Insforge GET /api/auth/sessions/current
//   3. 拿到 { id, email } 或 null
//
// 所有需要登录的 API 头一行 `const user = await getUser(); if (!user) return 401`。
// /r/[id] 公开报告 + /api/auth/* + admin 接口 (cron, worker-health) 不需要调它。

import { cookies } from "next/headers";

const BASE = process.env.INSFORGE_API_BASE_URL;

export interface SessionUser {
  id: string;
  email: string;
}

// 读 cookie + 调 Insforge 校验, 任何失败返 null (静默, 让调用方自己决定 401)。
export async function getUser(): Promise<SessionUser | null> {
  if (!BASE) return null;
  const token = (await cookies()).get("sh_token")?.value;
  if (!token) return null;
  try {
    const r = await fetch(`${BASE}/api/auth/sessions/current`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!r.ok) return null;
    const j = await r.json();
    const user = j?.user;
    if (!user?.id || !user?.email) return null;
    return { id: String(user.id), email: String(user.email) };
  } catch {
    return null;
  }
}

// 包装: 拿不到用户直接抛 Response(401), 调用方用 try/catch 接住。
// 实际 API 里更喜欢明确的 if (!user) return new Response("...", {status:401}),
// 这个 helper 给 catch-all 场景留着。
export class UnauthorizedError extends Error {
  constructor() { super("unauthorized"); }
}
export async function requireUser(): Promise<SessionUser> {
  const u = await getUser();
  if (!u) throw new UnauthorizedError();
  return u;
}
