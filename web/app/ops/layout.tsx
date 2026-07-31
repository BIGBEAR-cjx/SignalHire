import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SignalHire Ops",
  robots: { index: false, follow: false },
};

export default function OpsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f]">{children}</div>;
}
