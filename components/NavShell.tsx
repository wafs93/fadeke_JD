"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SignOutButton } from "@/components/SignOutButton";

const TABS = [
  { href: "/", label: "Job feed" },
  { href: "/tracker", label: "Tracker" },
  { href: "/scam-check", label: "Scam check" },
  { href: "/profile", label: "Profile" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/" || pathname.startsWith("/jobs");
  return pathname.startsWith(href);
}

export function NavShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const bare = pathname === "/login" || pathname.endsWith("/print");

  if (bare) {
    return <div className="min-h-screen bg-surface">{children}</div>;
  }

  return (
    <div className="min-h-screen bg-surface text-ink">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:text-black"
      >
        Skip to content
      </a>
      <header className="danfo-band no-print border-b-[6px] border-[#111] bg-danfo text-[#111]">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 pt-3 sm:px-6">
          <Link href="/" className="font-display text-xl font-extrabold tracking-tight sm:text-2xl">
            Fadeke&apos;s Job Desk
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <SignOutButton />
          </div>
        </div>
        <nav aria-label="Main" className="mx-auto max-w-7xl overflow-x-auto px-2 sm:px-4">
          <ul className="flex gap-1 py-2">
            {TABS.map((tab) => {
              const active = isActive(pathname, tab.href);
              return (
                <li key={tab.href}>
                  <Link
                    href={tab.href}
                    aria-current={active ? "page" : undefined}
                    className={`block whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold ${
                      active ? "bg-[#111] text-danfo" : "text-[#111] hover:bg-black/10"
                    }`}
                  >
                    {tab.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </header>
      <main id="main" className="mx-auto max-w-7xl px-4 pb-20 pt-5 sm:px-6">
        {children}
      </main>
    </div>
  );
}
