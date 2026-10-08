import type { JobSource } from "@/lib/sources/types";
import type { RawJob } from "@/lib/types";
import { fetchWithTimeout, stripHtml, toIsoOrNull } from "@/lib/util";

// Public API: https://remoteok.com/api (first array item is the legal notice).
// Terms: link back to the Remote OK job URL and name Remote OK as the source.
// One request per run, at most every 6 hours.

interface RemoteOkJob {
  id?: string | number;
  slug?: string;
  epoch?: number;
  date?: string;
  company?: string;
  position?: string;
  description?: string;
  location?: string;
  salary_min?: number;
  salary_max?: number;
  url?: string;
}

/** Remote OK's API sometimes serves UTF-8 text that was decoded as Latin-1
 * ("fÃ¼r" for "für"). Re-decode only when that pattern shows up. */
export function fixMojibake(s: string | undefined): string {
  if (!s) return "";
  if (!/[ÃÂâ][\u0080-\u00ff]/.test(s)) return s;
  try {
    const fixed = Buffer.from(s, "latin1").toString("utf8");
    return fixed.includes("\ufffd") ? s : fixed;
  } catch {
    return s;
  }
}

function salaryText(min?: number, max?: number): string | null {
  if (!min && !max) return null;
  const fmt = (n: number) => `$${Math.round(n / 1000)}k`;
  if (min && max && max !== min) return `${fmt(min)}–${fmt(max)} a year`;
  return `${fmt((min || max) as number)} a year`;
}

export const remoteok: JobSource = {
  id: "remoteok",
  name: "Remote OK",
  homepage: "https://remoteok.com",
  minIntervalMinutes: 6 * 60,
  async fetchJobs() {
    const res = await fetchWithTimeout("https://remoteok.com/api");
    if (!res.ok) throw new Error(`Remote OK ${res.status}`);
    const body = (await res.json()) as RemoteOkJob[];
    const jobs: RawJob[] = [];
    for (const j of Array.isArray(body) ? body : []) {
      if (!j?.id || !j.position) continue; // skips the legal-notice item
      const url = j.url || `https://remoteok.com/remote-jobs/${j.slug ?? j.id}`;
      jobs.push({
        source: "remoteok",
        external_id: String(j.id),
        title: fixMojibake(j.position).trim(),
        company: fixMojibake(j.company).trim(),
        url,
        description: stripHtml(fixMojibake(j.description)),
        region_text: fixMojibake(j.location).trim(),
        posted_at: toIsoOrNull(j.epoch ?? j.date),
        salary_text: salaryText(j.salary_min, j.salary_max),
      });
    }
    return jobs;
  },
};
