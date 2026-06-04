import Link from "next/link";
import type { IconType } from "react-icons";
import {
  FiActivity,
  FiCheckCircle,
  FiClock,
  FiClipboard,
  FiX,
  FiFolder,
  FiHome,
  FiLogOut,
  FiPlus,
  FiSearch,
  FiSettings,
  FiUser,
} from "react-icons/fi";

export type AppNavItem = {
  href: string;
  label: string;
  shortLabel: string;
  Icon: IconType;
};

export const APP_NAV: AppNavItem[] = [
  { href: "/app", label: "总览", shortLabel: "总览", Icon: FiHome },
  { href: "/app/projects", label: "招聘项目", shortLabel: "项目", Icon: FiFolder },
  { href: "/app/search", label: "智能搜人", shortLabel: "搜人", Icon: FiSearch },
  { href: "/app/verify", label: "核验台", shortLabel: "核验", Icon: FiCheckCircle },
  { href: "/app/shortlist", label: "候选池", shortLabel: "候选", Icon: FiClipboard },
  { href: "/app/history", label: "历史", shortLabel: "历史", Icon: FiClock },
];

export const SETTINGS_NAV: AppNavItem = {
  href: "/app/settings",
  label: "设置",
  shortLabel: "设置",
  Icon: FiSettings,
};

export function LogoMark({
  className = "",
  tone = "dark",
}: {
  className?: string;
  tone?: "dark" | "light";
}) {
  const stroke = tone === "light" ? "#ffffff" : "#1d1d1f";
  return (
    <svg viewBox="0 0 512 512" className={className} aria-hidden="true">
      <g stroke={stroke} strokeWidth={22} fill="none" strokeLinecap="round">
        <circle cx="256" cy="256" r="130" />
        <circle cx="256" cy="256" r="70" />
        <path d="M186 256a70 70 0 1 0 70-70" />
      </g>
      <circle cx="256" cy="256" r="16" fill="#7ee787" />
    </svg>
  );
}

export function Surface({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <section className={`sh-surface ${className}`}>{children}</section>;
}

export function IconTile({
  Icon,
  tone = "neutral",
}: {
  Icon: IconType;
  tone?: "neutral" | "blue" | "green" | "amber";
}) {
  const toneClass = {
    neutral: "bg-neutral-100 text-neutral-700 ring-neutral-200",
    blue: "bg-blue-50 text-blue-600 ring-blue-100",
    green: "bg-emerald-50 text-emerald-600 ring-emerald-100",
    amber: "bg-amber-50 text-amber-700 ring-amber-100",
  }[tone];
  return (
    <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ring-1 ${toneClass}`}>
      <Icon className="h-5 w-5" aria-hidden="true" />
    </span>
  );
}

export function PrimaryAction({
  href,
  onClick,
  children,
  className = "",
  disabled = false,
}: {
  href?: string;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  const cls = `sh-primary-action ${disabled ? "pointer-events-none opacity-50" : ""} ${className}`;
  if (href) return <Link href={href} className={cls} aria-disabled={disabled}>{children}</Link>;
  return <button type="button" onClick={onClick} disabled={disabled} className={cls}>{children}</button>;
}

export function SecondaryAction({
  href,
  onClick,
  children,
  className = "",
  disabled = false,
}: {
  href?: string;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  const cls = `sh-secondary-action ${disabled ? "pointer-events-none opacity-50" : ""} ${className}`;
  if (href) return <Link href={href} className={cls} aria-disabled={disabled}>{children}</Link>;
  return <button type="button" onClick={onClick} disabled={disabled} className={cls}>{children}</button>;
}

export function Pill({
  children,
  active = false,
  className = "",
}: {
  children: React.ReactNode;
  active?: boolean;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1 ${
      active
        ? "bg-neutral-950 text-white ring-neutral-950"
        : "bg-white/80 text-neutral-600 ring-black/10"
    } ${className}`}>
      {children}
    </span>
  );
}

export function PageIntro({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
      <div className="max-w-3xl">
        {eyebrow && <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">{eyebrow}</p>}
        <h1 className="mt-2 text-4xl font-semibold leading-tight text-[var(--sh-ink)] md:text-5xl">{title}</h1>
        {description && <p className="mt-3 max-w-2xl text-base leading-7 text-[var(--sh-muted)]">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function MetricCard({
  label,
  value,
  sub,
  Icon = FiActivity,
  tone = "neutral",
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  Icon?: IconType;
  tone?: "neutral" | "blue" | "green" | "amber";
}) {
  return (
    <Surface className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-[var(--sh-muted)]">{label}</p>
          <p className="mt-3 text-4xl font-semibold tracking-tight text-[var(--sh-ink)] tabular-nums">{value}</p>
          {sub && <p className="mt-1 text-xs text-[var(--sh-faint)]">{sub}</p>}
        </div>
        <IconTile Icon={Icon} tone={tone} />
      </div>
    </Surface>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <Surface className="p-8 text-center">
      <p className="text-base font-semibold text-[var(--sh-ink)]">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--sh-muted)]">{description}</p>
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </Surface>
  );
}

export function LoadingState({
  title = "正在加载",
  description = "正在同步最新数据。",
  className = "",
}: {
  title?: string;
  description?: string;
  className?: string;
}) {
  return (
    <Surface className={`p-5 ${className}`}>
      <div className="flex items-center gap-4">
        <span className="relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white ring-1 ring-black/10">
          <span className="absolute h-8 w-8 animate-ping rounded-full bg-[var(--sh-blue)]/12" />
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--sh-blue)]" />
        </span>
        <div>
          <p className="text-sm font-semibold text-[var(--sh-ink)]">{title}</p>
          <p className="mt-1 text-sm text-[var(--sh-muted)]">{description}</p>
        </div>
      </div>
    </Surface>
  );
}

export function StatusBadge({
  label,
  dotClassName = "bg-neutral-400",
  className = "",
}: {
  label: string;
  dotClassName?: string;
  className?: string;
}) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white/80 px-2.5 py-1 text-xs font-semibold text-[var(--sh-muted)] ring-1 ring-black/10 ${className}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dotClassName}`} />
      {label}
    </span>
  );
}

export function SegmentedControl<T extends string>({
  items,
  value,
  onChange,
}: {
  items: Array<{ value: T; label: string; count?: number }>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="inline-flex max-w-full flex-wrap gap-1 rounded-full bg-white/72 p-1 ring-1 ring-black/10">
      {items.map((item) => {
        const active = value === item.value;
        return (
          <button
            key={item.value}
            type="button"
            onClick={() => onChange(item.value)}
            className={`inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition ${
              active ? "bg-[var(--sh-ink)] text-white shadow-sm" : "text-[var(--sh-muted)] hover:bg-neutral-100"
            }`}
          >
            <span>{item.label}</span>
            {typeof item.count === "number" && (
              <span className={active ? "text-white/65" : "text-[var(--sh-faint)]"}>{item.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function IconButton({
  label,
  onClick,
  Icon = FiX,
  tone = "neutral",
  className = "",
}: {
  label: string;
  onClick?: () => void;
  Icon?: IconType;
  tone?: "neutral" | "danger";
  className?: string;
}) {
  const toneClass = tone === "danger"
    ? "text-red-600 hover:bg-red-50"
    : "text-[var(--sh-muted)] hover:bg-neutral-100";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-full transition ${toneClass} ${className}`}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}

export function SoftListRow({
  children,
  active = false,
  className = "",
}: {
  children: React.ReactNode;
  active?: boolean;
  className?: string;
}) {
  return (
    <div className={`rounded-3xl border bg-white/84 p-4 text-left transition ${
      active ? "border-[var(--sh-ink)] shadow-[0_18px_48px_rgba(0,0,0,0.08)]" : "border-black/10 hover:border-black/20"
    } ${className}`}>
      {children}
    </div>
  );
}

export { FiLogOut, FiPlus, FiSearch, FiUser };
