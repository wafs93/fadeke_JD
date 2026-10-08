export type ChipTone = "good" | "warn" | "bad" | "info" | "neutral";

// Every tone carries a symbol as well as a colour, so meaning never depends
// on colour alone.
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
      className="inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{ background: `var(--${tone}-bg)`, color: `var(--${tone}-fg)` }}
    >
      {mark && (
        <span aria-hidden="true" className="shrink-0">
          {mark}
        </span>
      )}
      <span className="min-w-0 truncate">{children}</span>
    </span>
  );
}
