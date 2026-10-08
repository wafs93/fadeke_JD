export type ChipTone = "good" | "warn" | "bad" | "info" | "neutral";

// Each tone carries a text symbol as well as a colour, so meaning never
// depends on colour alone.
const SYMBOL: Record<ChipTone, string> = {
  good: "✓",
  warn: "!",
  bad: "✕",
  info: "i",
  neutral: "•",
};

export function Chip({
  tone = "neutral",
  children,
  title,
  symbol,
}: {
  tone?: ChipTone;
  children: React.ReactNode;
  title?: string;
  symbol?: string | null;
}) {
  const mark = symbol === undefined ? SYMBOL[tone] : symbol;
  return (
    <span
      title={title}
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-semibold"
      style={{
        background: `var(--${tone}-bg)`,
        color: `var(--${tone}-fg)`,
        borderColor: `var(--${tone}-fg)`,
      }}
    >
      {mark && <span aria-hidden="true">{mark}</span>}
      {children}
    </span>
  );
}
