"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SignOutButton } from "@/components/SignOutButton";
import { HeartMark, JobsIcon, ProfileIcon, ShieldIcon, TrackerIcon } from "@/components/Icons";
import { APP_NAME } from "@/lib/brand";

const TABS = [
  { href: "/", label: "Jobs", Icon: JobsIcon },
  { href: "/tracker", label: "Tracker", Icon: TrackerIcon },
  { href: "/scam-check", label: "Scam check", Icon: ShieldIcon },
  { href: "/profile", label: "Profile", Icon: ProfileIcon },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/" || pathname.startsWith("/jobs");
  return pathname.startsWith(href);
}

export function NavShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const bare = pathname === "/login" || pathname.endsWith("/print");

  if (bare) {
    return <div className="min-h-dvh bg-surface">{children}</div>;
  }

  return (
    <div className="min-h-dvh bg-surface text-ink">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-full focus:bg-raised focus:px-4 focus:py-2 focus:text-ink"
      >
        Skip to content
      </a>

      <header className="no-print border-b border-line bg-tint" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-2 sm:px-6 sm:py-3">
          <Link href="/" className="flex min-h-[44px] items-center gap-2 text-ink">
            <HeartMark className="h-6 w-6 text-rose" />
            <span className="whitespace-nowrap font-display text-[1.25rem] leading-none min-[390px]:text-[1.375rem] sm:text-2xl">{APP_NAME}</span>
          </Link>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <SignOutButton />
          </div>
        </div>

        {/* Desktop and tablet: tabs under the name. Phones use the bottom bar. */}
        <nav aria-label="Main" className="mx-auto hidden max-w-6xl px-4 pb-3 sm:px-6 lg:block">
          <ul className="flex gap-2">
            {TABS.map(({ href, label, Icon }) => {
              const active = isActive(pathname, href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={`flex min-h-[44px] items-center gap-2 rounded-full px-4 font-semibold ${
                      active ? "bg-rose text-[var(--on-primary)]" : "text-ink hover:bg-raised"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </header>

      <main id="main" className="tabbar-pad mx-auto max-w-6xl px-4 pt-5 sm:px-6">
        {children}
      </main>

      <nav
        aria-label="Main"
        className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-line bg-raised lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="mx-auto grid h-[var(--tabbar-h)] max-w-xl grid-cols-4">
          {TABS.map(({ href, label, Icon }) => {
            const active = isActive(pathname, href);
            return (
              <li key={href} className="h-full">
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`flex h-full flex-col items-center justify-center gap-0.5 text-xs font-semibold ${
                    active ? "text-rose-strong" : "text-muted"
                  }`}
                >
                  <span
                    className={`flex h-7 w-12 items-center justify-center rounded-full ${active ? "bg-tint" : ""}`}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
