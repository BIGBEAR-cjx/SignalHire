import type { Metadata } from "next";
// 用本地打包的 geist 字体包(非 next/font/google), 构建不再依赖 fonts.gstatic.com 网络,
// 更快、离线/受限网络也能构建。CSS 变量名仍是 --font-geist-sans / --font-geist-mono。
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title: "SignalHire — Find signals. Not resumes.",
  description:
    "面向公司 HR 和猎头的全球 AI 人才搜索平台，生成候选人 shortlist、人才地图和可审计的交叉验证证据。",
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
      <body className="min-h-full">{children}</body>
    </html>
  );
}
