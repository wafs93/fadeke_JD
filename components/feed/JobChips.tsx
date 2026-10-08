import { Chip } from "@/components/Chip";
import type { ScamLevel } from "@/lib/types";

function shorten(s: string, max = 60): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

/** Nigeria eligibility. Open jobs show the phrase from the post so she can
 * check it herself. */
export function NgChip({
  eligible,
  reason,
  evidence,
}: {
  eligible: boolean | null;
  reason?: string | null;
  evidence?: string | null;
}) {
  if (eligible === true) {
    return (
      <Chip tone="good" title={evidence ?? reason ?? undefined}>
        {evidence ? `Open: ${shorten(evidence.replace(/\s*\([^)]*\)\s*/g, " ")) || shorten(evidence)}` : "Open to Nigeria"}
      </Chip>
    );
  }
  if (eligible === false) return <Chip tone="bad" title={reason ?? undefined}>Not open to Nigeria</Chip>;
  return (
    <Chip tone="warn" title={reason ?? undefined}>
      Location not stated. Check before applying.
    </Chip>
  );
}

/** Safety status, in words: safe, caution or avoid. */
export function ScamChip({ level, score }: { level: ScamLevel; score?: number }) {
  const suffix = score !== undefined ? ` (${score})` : "";
  if (level === "high") return <Chip tone="bad">Avoid: strong scam signs{suffix}</Chip>;
  if (level === "medium") return <Chip tone="warn">Caution: some scam signs{suffix}</Chip>;
  return <Chip tone="good">Safe: no scam signs{suffix}</Chip>;
}

export function fitLabel(score: number): string {
  if (score >= 75) return "Strong fit";
  if (score >= 50) return "Fair fit";
  return "Weak fit";
}

/** A soft rose ring with the score inside and the fit in words beneath. */
export function ScoreBadge({ score, size = "md" }: { score: number | null; size?: "md" | "lg" }) {
  const px = size === "lg" ? 76 : 60;
  const stroke = size === "lg" ? 6 : 5;
  const r = (px - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const value = score ?? 0;

  return (
    <span className="flex shrink-0 flex-col items-center gap-1" style={{ width: px + 8 }}>
      <span className="relative inline-flex items-center justify-center" style={{ width: px, height: px }}>
        <svg width={px} height={px} viewBox={`0 0 ${px} ${px}`} aria-hidden="true" className="-rotate-90">
          <circle cx={px / 2} cy={px / 2} r={r} fill="none" stroke="var(--ring-track)" strokeWidth={stroke} />
          {score !== null && (
            <circle
              cx={px / 2}
              cy={px / 2}
              r={r}
              fill="none"
              stroke="var(--primary)"
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${(circ * value) / 100} ${circ}`}
            />
          )}
        </svg>
        <span className={`absolute font-display text-ink ${size === "lg" ? "text-[1.75rem]" : "text-[1.375rem]"}`}>
          {score === null ? "–" : score}
        </span>
      </span>
      <span className="text-center text-xs font-semibold leading-tight text-muted">
        {score === null ? "Not scored" : fitLabel(score)}
      </span>
      <span className="sr-only">{score === null ? "Not scored yet" : `Match score ${score} out of 100`}</span>
    </span>
  );
}
