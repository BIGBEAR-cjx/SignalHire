import type { Metadata } from "next";
// 用本地打包的 geist 字体包(非 next/font/google), 构建不再依赖 fonts.gstatic.com 网络,
// 更快、离线/受限网络也能构建。CSS 变量名仍是 --font-geist-sans / --font-geist-mono。
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title: "SignalHire — Find signals. Not resumes.",
  description:
    "用 MiroMind 深度搜索候选人，并对每条声称做跨源交叉验证，亮出可点击的证据。Find signals, not resumes. UCWS 2026 · MiroMind Deep Research Track。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
