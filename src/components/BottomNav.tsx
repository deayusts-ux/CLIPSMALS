"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./Icon";

const TABS = [
  { href: "/", label: "Generate", icon: "auto_fix_high" },
  { href: "/clips", label: "Clips", icon: "movie" },
  { href: "/templates", label: "Templates", icon: "subtitles" },
  { href: "/profile", label: "Profile", icon: "person" },
];

export function BottomNav({ clipCount }: { clipCount?: number }) {
  const pathname = usePathname();
  const active = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);
  return (
    <nav className="fixed bottom-0 left-0 w-full z-50 pb-safe px-margin mb-space-sm pointer-events-none">
      <div className="pointer-events-auto mx-auto max-w-[420px] h-16 rounded-full bg-surface-container/85 backdrop-blur-xl shadow-[0_12px_32px_-8px_rgba(0,0,0,0.65)] flex items-center justify-around px-space-md border border-white/5">
        {TABS.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active(tab.href) ? "page" : undefined}
            className={`relative flex flex-col items-center justify-center min-w-[56px] min-h-[44px] py-1 transition-colors ${
              active(tab.href)
                ? "text-primary font-bold"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            <Icon name={tab.icon} fill={active(tab.href)} />
            {tab.href === "/clips" && clipCount != null && clipCount > 0 && (
              <span className="absolute top-0.5 right-1 px-1.5 rounded-full bg-secondary text-on-secondary text-[9px] leading-tight font-bold">
                {clipCount > 99 ? "99+" : clipCount}
              </span>
            )}
            <span className="text-[10px] font-bold tracking-wide mt-0.5">
              {tab.label}
            </span>
            {active(tab.href) && (
              <span className="absolute -bottom-0.5 w-1 h-1 rounded-full bg-primary shadow-glow-primary" />
            )}
          </Link>
        ))}
      </div>
    </nav>
  );
}