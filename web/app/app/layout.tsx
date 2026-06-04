"use client";

// 控制台壳子 —— 左侧暗灰导航 + 右侧主区。/app/* 全部走这套。
// 未登录 → 弹 AuthModal, 关闭则回 /; 登录后续渲染子页。
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import AuthModal from "@/components/AuthModal";
import { currentUser, logout } from "@/lib/auth";
import {
  APP_NAV,
  FiLogOut,
  LoadingState,
  LogoMark,
  SETTINGS_NAV,
} from "@/components/ui/signal-ui";

type User = { email: string };

function isActivePath(currentPath: string, href: string) {
  return currentPath === href || (href !== "/app" && currentPath.startsWith(href));
}

function Sidebar({ user, currentPath, onLogout }: { user: User; currentPath: string; onLogout: () => void }) {
  return (
    <aside className="hidden w-[216px] shrink-0 border-r border-black/5 bg-white/72 px-3 py-4 backdrop-blur-2xl md:flex md:flex-col">
      <Link href="/" className="flex items-center gap-2 rounded-2xl px-3 py-2 text-[var(--sh-ink)]">
        <LogoMark className="h-7 w-7" />
        <span className="text-[15px] font-semibold tracking-tight">SignalHire</span>
      </Link>

      <nav className="mt-6 flex-1 space-y-1">
        {APP_NAV.map((item) => {
          const active = isActivePath(currentPath, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition ${
                active
                  ? "bg-neutral-950 text-white shadow-[0_12px_30px_rgba(0,0,0,0.14)]"
                  : "text-neutral-500 hover:bg-white hover:text-neutral-950"
              }`}
            >
              <item.Icon className="h-4 w-4" aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="space-y-2 border-t border-black/5 pt-3">
        <Link
          href={SETTINGS_NAV.href}
          className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition ${
            isActivePath(currentPath, SETTINGS_NAV.href)
              ? "bg-neutral-950 text-white"
              : "text-neutral-500 hover:bg-white hover:text-neutral-950"
          }`}
        >
          <SETTINGS_NAV.Icon className="h-4 w-4" aria-hidden="true" />
          <span>{SETTINGS_NAV.label}</span>
        </Link>
        <div className="rounded-2xl bg-white/70 px-3 py-3 ring-1 ring-black/5">
          <p className="truncate text-xs text-[var(--sh-muted)]" title={user.email}>{user.email}</p>
          <button
            onClick={onLogout}
            className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-950"
          >
            <FiLogOut className="h-3.5 w-3.5" aria-hidden="true" />
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
    <div className="flex items-center justify-between border-b border-black/5 bg-white/80 px-4 py-3 backdrop-blur-2xl md:hidden">
      <Link href="/" className="flex items-center gap-2 text-gray-900">
        <LogoMark className="h-6 w-6" />
        <span className="text-[15px] font-semibold tracking-tight">SignalHire</span>
      </Link>
      <div className="flex min-w-0 items-center gap-3">
        <span className="hidden max-w-[160px] truncate text-xs text-[var(--sh-muted)] sm:inline" title={user.email}>{user.email}</span>
        <Link
          href={SETTINGS_NAV.href}
          aria-label={SETTINGS_NAV.label}
          title={SETTINGS_NAV.label}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--sh-muted)] transition hover:bg-white hover:text-[var(--sh-ink)]"
        >
          <SETTINGS_NAV.Icon className="h-[18px] w-[18px]" aria-hidden="true" />
        </Link>
        <button onClick={onLogout} className="text-sm font-medium text-[var(--sh-muted)] hover:text-[var(--sh-ink)]">退出</button>
      </div>
    </div>
  );
}

// 移动端底部 tab 栏
function MobileBottomNav({ currentPath }: { currentPath: string }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-20 flex border-t border-black/5 bg-white/90 backdrop-blur-2xl md:hidden">
      {APP_NAV.map((item) => {
        const active = isActivePath(currentPath, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-1 flex-col items-center gap-1 py-2 text-[10px] font-medium ${
              active ? "text-[var(--sh-blue)]" : "text-[var(--sh-faint)]"
            }`}
          >
            <item.Icon className="h-5 w-5" aria-hidden="true" />
            <span>{item.shortLabel}</span>
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
      <div className="flex h-screen items-center justify-center bg-[var(--sh-canvas)] px-4">
        <LoadingState
          title="正在进入工作台"
          description="正在确认登录状态和加载你的招聘上下文。"
          className="w-full max-w-md"
        />
      </div>
    );
  }

  // 未登录 → 强制弹窗, 关闭回首页
  if (user === null) {
    return (
      <>
        <div className="flex h-screen flex-col items-center justify-center bg-[var(--sh-canvas)] px-4 text-center">
          <div className="sh-surface w-full max-w-md p-7">
            <LogoMark className="mx-auto h-10 w-10" />
            <p className="mt-4 text-lg font-semibold text-[var(--sh-ink)]">登录后继续使用工作台</p>
            <p className="mt-2 text-sm leading-6 text-[var(--sh-muted)]">SignalHire 会保护你的项目、候选池和研究历史。</p>
          </div>
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
    <div className="flex min-h-screen bg-[var(--sh-canvas)] text-[var(--sh-ink)]">
      <Sidebar user={user} currentPath={pathname} onLogout={handleLogout} />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileTopBar user={user} onLogout={handleLogout} />
        <main className="flex-1 px-4 pb-24 pt-5 md:px-8 md:pb-10 md:pt-8">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
        <MobileBottomNav currentPath={pathname} />
      </div>
    </div>
  );
}
