import { Chip } from "@/components/Chip";
import type { ScamLevel } from "@/lib/types";

export function NgChip({ eligible, reason }: { eligible: boolean | null; reason?: string | null }) {
  if (eligible === true) return <Chip tone="good" title={reason ?? undefined}>Open to Nigeria</Chip>;
  if (eligible === false) return <Chip tone="bad" title={reason ?? undefined}>Not open to Nigeria</Chip>;
  return (
    <Chip tone="info" symbol="?" title={reason ?? undefined}>
      Check location
    </Chip>
  );
}

export function ScamChip({ level, score }: { level: ScamLevel; score?: number }) {
  const suffix = score !== undefined ? ` (${score})` : "";
  if (level === "high") return <Chip tone="bad">High scam risk{suffix}</Chip>;
  if (level === "medium") return <Chip tone="warn">Some scam signs{suffix}</Chip>;
  return <Chip tone="good">Low scam risk{suffix}</Chip>;
}

export function fitLabel(score: number): string {
  if (score >= 75) return "Strong fit";
  if (score >= 50) return "Fair fit";
  return "Weak fit";
}

/** Score as a number plus words, never colour alone. */
export function ScoreBadge({ score, size = "md" }: { score: number | null; size?: "md" | "lg" }) {
  const big = size === "lg";
  if (score === null) {
    return (
      <span className={`inline-flex flex-col items-center justify-center rounded-lg border border-dashed border-line px-2 py-1 text-center text-muted ${big ? "min-w-[84px]" : "min-w-[64px]"}`}>
        <span className="text-xs font-semibold">Not scored</span>
      </span>
    );
  }
  const tone = score >= 75 ? "good" : score >= 50 ? "warn" : "neutral";
  return (
    <span
      className={`inline-flex flex-col items-center justify-center rounded-lg border-2 px-2 py-1 text-center ${big ? "min-w-[84px]" : "min-w-[64px]"}`}
      style={{ background: `var(--${tone}-bg)`, color: `var(--${tone}-fg)`, borderColor: `var(--${tone}-fg)` }}
    >
      <span className={`font-display font-extrabold leading-none ${big ? "text-3xl" : "text-xl"}`}>{score}</span>
      <span className="mt-0.5 text-[11px] font-semibold leading-tight">{fitLabel(score)}</span>
    </span>
  );
}
