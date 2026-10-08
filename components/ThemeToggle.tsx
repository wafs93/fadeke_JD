"use client";

import { useEffect, useState } from "react";

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
      className="min-h-[36px] rounded-full border-2 border-[#111] px-3 text-xs font-semibold hover:bg-black/10"
    >
      {dark ? "Light mode" : "Dark mode"}
    </button>
  );
}
