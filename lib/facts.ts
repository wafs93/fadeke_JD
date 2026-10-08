import type { ProfileBundle } from "@/lib/profile";
import { formatDateRange } from "@/lib/util";

/**
 * The only facts the model may use about Fadeke, as plain text. Unconfirmed
 * experiences appear by title and employer only, clearly marked, and their
 * duties are never included.
 */
export function profileFactsText(bundle: ProfileBundle): string {
  const p = bundle.profile;
  const lines: string[] = [];
  lines.push(`Name: ${p?.full_name || "[not given]"}`);
  lines.push(`Location: ${p?.location || "[not given]"}`);
  lines.push(`Timezone: ${p?.timezone || "[not given]"}`);
  lines.push(`Minimum hourly rate (USD): ${p?.min_hourly_rate ?? "[not given]"}`);
  lines.push(`Summary: ${p?.summary || "[not given]"}`);
  lines.push(`Skills: ${(p?.skills ?? []).join("; ") || "[none listed]"}`);
  lines.push(`Tools: ${(p?.tools ?? []).join("; ") || "[none listed]"}`);
  lines.push(`Languages: ${(p?.languages ?? []).join("; ") || "[none listed]"}`);
  lines.push("");
  lines.push("CONFIRMED EXPERIENCE:");
  const confirmed = bundle.experiences.filter((e) => e.verified);
  if (!confirmed.length) lines.push("(none)");
  for (const e of confirmed) {
    const dates = formatDateRange(e.start_date, e.end_date, e.current) || "dates not given";
    lines.push(`- id=${e.id} | ${e.title}, ${e.employer} | ${dates} | ${e.remote ? "Remote" : e.location || ""}`);
    e.bullets.forEach((b, i) => lines.push(`    [${i}] ${b.text}`));
  }
  const unconfirmed = bundle.experiences.filter((e) => !e.verified);
  if (unconfirmed.length) {
    lines.push("");
    lines.push("UNCONFIRMED EXPERIENCE (do NOT describe duties, dates or results for these):");
    for (const e of unconfirmed) lines.push(`- ${e.title}, ${e.employer}`);
  }
  lines.push("");
  lines.push("EDUCATION:");
  for (const ed of bundle.education) {
    const years = [ed.start_year, ed.end_year].filter(Boolean).join("–");
    lines.push(`- ${[ed.degree, ed.field].filter(Boolean).join(" ")}, ${ed.school}${years ? ` (${years})` : ""}`);
  }
  return lines.join("\n");
}
