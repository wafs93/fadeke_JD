import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-body)", "system-ui", "sans-serif"],
      },
      colors: {
        danfo: {
          DEFAULT: "#F2B705",
          ink: "#111111",
        },
        surface: "var(--bg)",
        raised: "var(--bg-elevated)",
        line: "var(--border)",
        ink: "var(--text)",
        muted: "var(--text-muted)",
      },
    },
  },
  plugins: [],
};

export default config;
