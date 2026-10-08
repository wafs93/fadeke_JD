import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      // Body copy is never below 16px: "text-sm" is 16px and "text-xs" (chips,
      // hints, tab labels only) is 14px.
      fontSize: {
        xs: ["0.875rem", { lineHeight: "1.25rem" }],
        sm: ["1rem", { lineHeight: "1.5rem" }],
      },
      fontFamily: {
        sans: ["var(--font-body)", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        display: ["var(--font-display)", "Georgia", "Times New Roman", "serif"],
      },
      colors: {
        surface: "var(--bg)",
        raised: "var(--bg-elevated)",
        sunken: "var(--bg-sunken)",
        line: "var(--border)",
        ink: "var(--text)",
        muted: "var(--text-muted)",
        tint: "var(--tint)",
        rose: {
          DEFAULT: "var(--primary)",
          strong: "var(--primary-strong)",
        },
        lilac: {
          DEFAULT: "var(--accent)",
          strong: "var(--accent-strong)",
        },
      },
    },
  },
  plugins: [],
};

export default config;
