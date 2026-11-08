"use client";

import Link from "next/link";
import { Icon } from "./Icon";

export function Header() {
  return (
    <header className="fixed top-0 left-0 w-full z-40 pt-safe bg-surface/80 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.12)]">
      <div className="h-14 px-margin mx-auto max-w-[480px] flex items-center justify-between">
        <Link href="/" className="flex items-center gap-space-sm">
          <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-primary-container to-inverse-primary shadow-glow-primary">
            <Icon name="bolt" fill className="text-on-primary-container" size={20} />
          </span>
          <span className="font-headline font-semibold text-[16px] text-on-surface tracking-tight">
            KlipViral AI
          </span>
          <span className="px-space-sm py-0.5 rounded-full bg-primary-container text-on-primary-container text-[10px] font-bold uppercase tracking-wider">
            PRO
          </span>
        </Link>
        <Link
          href="/profile"
          aria-label="Account"
          className="flex items-center justify-center w-9 h-9 rounded-full bg-surface-container-high ring-2 ring-primary/20 hover:ring-primary/50 transition-all"
        >
          <Icon name="person" className="text-primary" size={20} />
        </Link>
      </div>
    </header>
  );
}