"use client";

// /app/settings —— 设置(最小版)
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { logout } from "@/lib/auth";

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // 从服务端拿 (含 user.id, 方便 SQL backfill 用)
    fetch("/api/whoami")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j?.user && setUser(j.user))
      .catch(() => {});
  }, []);

  async function handleLogout() {
    await logout();
    router.push("/");
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">设置</h1>
        <p className="mt-1 text-sm text-gray-500">账户和偏好。更多设置项会陆续加上。</p>
      </header>

      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
        <h2 className="text-base font-semibold text-gray-900">账户</h2>
        <dl className="mt-3 space-y-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-gray-500">邮箱</dt>
            <dd className="font-medium text-gray-900">{user?.email ?? "加载中…"}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-gray-500">User ID</dt>
            <dd className="flex items-center gap-2">
              <code className="rounded bg-gray-50 px-2 py-1 font-mono text-xs text-gray-700">
                {user?.id ?? "加载中…"}
              </code>
              {user?.id && (
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(user.id);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                  className="rounded-md border border-gray-200 px-2 py-0.5 text-xs text-gray-600 hover:border-gray-900"
                >
                  {copied ? "✓" : "复制"}
                </button>
              )}
            </dd>
          </div>
        </dl>
        <button
          onClick={handleLogout}
          className="mt-5 rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:border-gray-900"
        >
          退出登录
        </button>
      </section>

      <section className="rounded-2xl border border-dashed border-gray-200 bg-white p-5">
        <h2 className="text-base font-semibold text-gray-900">即将上线</h2>
        <ul className="mt-3 space-y-2 text-sm text-gray-500">
          <li>· 修改密码</li>
          <li>· 邮件通知偏好</li>
          <li>· 团队 / 协作(Coming soon)</li>
          <li>· 计费 / 用量(Coming soon)</li>
          <li>· API Keys(Coming soon)</li>
        </ul>
      </section>
    </div>
  );
}
