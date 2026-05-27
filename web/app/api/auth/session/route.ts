// /api/auth/session —— 登录态 cookie。POST 设置, DELETE 清除。
// 用 httpOnly cookie 存 accessToken (比 localStorage 抗 XSS), 供服务端路由读取登录态。
import { cookies } from "next/headers";

export const runtime = "nodejs";

const COOKIE = "sh_token";

export async function POST(req: Request) {
  let accessToken = "";
  try { ({ accessToken } = await req.json()); } catch {}
  if (!accessToken) return Response.json({ error: "缺少 accessToken" }, { status: 400 });
  const jar = await cookies();
  jar.set(COOKIE, accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 天
  });
  return Response.json({ ok: true });
}

export async function DELETE() {
  const jar = await cookies();
  jar.delete(COOKIE);
  return Response.json({ ok: true });
}
