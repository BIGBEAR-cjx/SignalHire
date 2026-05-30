"use client";

// 控制台壳子 —— 左侧暗灰导航 + 右侧主区。/app/* 全部走这套。
// 未登录 → 弹 AuthModal, 关闭则回 /; 登录后续渲染子页。
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import AuthModal from "@/components/AuthModal";
import { currentUser, logout } from "@/lib/auth";

type User = { email: string };

const NAV = [
  { href: "/app", label: "总览", icon: "🏠" },
  { href: "/app/search", label: "智能搜人", icon: "🔍" },
  { href: "/app/verify", label: "核验台", icon: "✅" },
  { href: "/app/shortlist", label: "候选池", icon: "📋" },
  { href: "/app/history", label: "历史", icon: "🕓" },
];

function LogoMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" className={className} aria-hidden="true">
      <g stroke="#ffffff" strokeWidth={22} fill="none" strokeLinecap="round">
        <circle cx="256" cy="256" r="130" />
        <circle cx="256" cy="256" r="70" />
        <path d="M186 256a70 70 0 1 0 70-70" />
      </g>
      <circle cx="256" cy="256" r="16" fill="#9EFF4F" />
    </svg>
  );
}

function Sidebar({ user, currentPath, onLogout }: { user: User; currentPath: string; onLogout: () => void }) {
  return (
    <aside className="hidden w-[240px] shrink-0 flex-col bg-gray-950 text-gray-300 md:flex">
      {/* logo */}
      <Link href="/" className="flex items-center gap-2 px-5 py-5 text-white">
        <LogoMark className="h-7 w-7" />
        <span className="text-[15px] font-semibold tracking-tight">SignalHire</span>
      </Link>

      {/* 主导航 */}
      <nav className="mt-2 flex-1 space-y-0.5 px-3">
        {NAV.map((item) => {
          const active = currentPath === item.href || (item.href !== "/app" && currentPath.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                active
                  ? "bg-gray-800 text-white"
                  : "text-gray-400 hover:bg-gray-900 hover:text-white"
              }`}
            >
              <span className="text-base leading-none">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* 底部:设置 + 用户 */}
      <div className="border-t border-gray-900 px-3 py-3">
        <Link
          href="/app/settings"
          className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
            currentPath.startsWith("/app/settings")
              ? "bg-gray-800 text-white"
              : "text-gray-400 hover:bg-gray-900 hover:text-white"
          }`}
        >
          <span className="text-base leading-none">⚙️</span>
          <span>设置</span>
        </Link>
        <div className="mt-2 rounded-lg px-3 py-2 text-xs">
          <p className="truncate text-gray-500" title={user.email}>{user.email}</p>
          <button
            onClick={onLogout}
            className="mt-1 text-gray-400 underline-offset-2 hover:text-white hover:underline"
          >
            退出
          </button>
        </div>
      </div>
    </aside>
  );
}

// 移动端顶栏 (md 以下用)
function MobileTopBar({ user, onLogout }: { user: User; onLogout: () => void }) {
  return (
    <div className="flex items-center justify-between border-b border-gray-100 bg-white px-4 py-3 md:hidden">
      <Link href="/" className="flex items-center gap-2 text-gray-900">
        <svg viewBox="0 0 512 512" className="h-6 w-6" aria-hidden="true">
          <g stroke="#111" strokeWidth={22} fill="none" strokeLinecap="round">
            <circle cx="256" cy="256" r="130" />
            <circle cx="256" cy="256" r="70" />
            <path d="M186 256a70 70 0 1 0 70-70" />
          </g>
          <circle cx="256" cy="256" r="16" fill="#9EFF4F" />
        </svg>
        <span className="text-[15px] font-semibold tracking-tight">SignalHire</span>
      </Link>
      <button onClick={onLogout} className="text-sm text-gray-500 hover:text-gray-900">退出</button>
    </div>
  );
}

// 移动端底部 tab 栏
function MobileBottomNav({ currentPath }: { currentPath: string }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-20 flex border-t border-gray-100 bg-white md:hidden">
      {NAV.map((item) => {
        const active = currentPath === item.href || (item.href !== "/app" && currentPath.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] ${
              active ? "text-gray-900" : "text-gray-400"
            }`}
          >
            <span className="text-base">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null | undefined>(undefined); // undefined = 初始加载中

  useEffect(() => {
    currentUser().then((u) => setUser(u));
  }, []);

  async function handleLogout() {
    await logout();
    setUser(null);
    router.push("/");
  }

  // 初始加载
  if (user === undefined) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-gray-400">
        加载中…
      </div>
    );
  }

  // 未登录 → 强制弹窗, 关闭回首页
  if (user === null) {
    return (
      <>
        <div className="flex h-screen flex-col items-center justify-center px-4 text-center">
          <p className="text-sm text-gray-500">请先登录使用 SignalHire 控制台</p>
        </div>
        <AuthModal
          open={true}
          onClose={() => router.push("/")}
          onAuthed={(u) => setUser(u)}
        />
      </>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar user={user} currentPath={pathname} onLogout={handleLogout} />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileTopBar user={user} onLogout={handleLogout} />
        <main className="flex-1 px-4 pb-20 pt-6 md:px-8 md:pb-8 md:pt-8">
          <div className="mx-auto max-w-5xl">{children}</div>
        </main>
        <MobileBottomNav currentPath={pathname} />
      </div>
    </div>
  );
}
