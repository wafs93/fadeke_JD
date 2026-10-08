"use client";

import { useEffect, useState } from "react";
import { MoonIcon, SunIcon } from "@/components/Icons";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      // ignore — private browsing / blocked storage
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={dark}
      className="flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-full px-2.5 text-sm font-semibold text-ink hover:bg-raised"
    >
      {dark ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
      <span className="hidden sm:inline">{dark ? "Light" : "Dark"}</span>
      <span className="sr-only sm:hidden">{dark ? "Light mode" : "Dark mode"}</span>
    </button>
  );
}
