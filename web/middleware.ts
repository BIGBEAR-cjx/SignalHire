// middleware.ts —— 全站登录墙。无 sh_token cookie 一律跳 /login。
// 放行: 登录/注册页、公开报告 /r/[id]、auth 接口、静态资源。
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PREFIXES = ["/login", "/register", "/r/", "/api/auth/"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isPublic = PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p));
  if (isPublic) return NextResponse.next();

  const token = req.cookies.get("sh_token")?.value;
  if (token) return NextResponse.next();

  // 未登录 → 跳登录, 带回跳地址
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname + req.nextUrl.search);
  return NextResponse.redirect(url);
}

// 排除静态资源 / 图片 / favicon (matcher 不拦这些)
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|brand/).*)"],
};
