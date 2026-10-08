import type { JobSource } from "@/lib/sources/types";
import type { RawJob } from "@/lib/types";
import { fetchWithTimeout, stripHtml, toIsoOrNull } from "@/lib/util";

// Public API: https://himalayas.app/jobs/api/search
// Terms: link back to the Himalayas URL and name Himalayas as the source.
// Data refreshes every 24 hours, so we fetch at most every 12 hours.
// `country=Nigeria` asks Himalayas for jobs whose location restrictions
// include Nigeria or that have none, so we don't pull jobs she can't take.
const QUERIES = ["virtual assistant", "executive assistant", "administrative assistant", "customer support"];

interface HimalayasJob {
  title?: string;
  companyName?: string;
  guid?: string;
  applicationLink?: string;
  locationRestrictions?: Array<string | { name?: string }>;
  timezoneRestriction?: unknown;
  timezoneRestrictions?: unknown;
  description?: string;
  excerpt?: string;
  pubDate?: number | string;
  minSalary?: number | null;
  maxSalary?: number | null;
  currency?: string | null;
  salaryPeriod?: string | null;
}

function regionText(j: HimalayasJob): string {
  const names = (j.locationRestrictions ?? [])
    .map((r) => (typeof r === "string" ? r : r?.name ?? ""))
    .filter(Boolean);
  // Himalayas leaves locationRestrictions empty when a job has none.
  return names.length ? names.join(", ") : "Worldwide (no location restrictions listed on Himalayas)";
}

/** " · Time zones UTC-8 to UTC-5 only" when the job limits time zones;
 * empty when every zone (or none) is listed. */
function timezoneText(j: HimalayasJob): string {
  const raw = j.timezoneRestrictions ?? j.timezoneRestriction;
  const zones = (Array.isArray(raw) ? raw : []).map(Number).filter((n) => Number.isFinite(n));
  if (zones.length === 0 || zones.length >= 24) return "";
  const fmt = (n: number) => `UTC${n >= 0 ? "+" : ""}${n}`;
  return ` · Time zones ${fmt(Math.min(...zones))} to ${fmt(Math.max(...zones))} only`;
}

/** Maps one search response to jobs. Exported for tests and backfills. */
export function mapHimalayasJobs(body: { jobs?: HimalayasJob[] }): RawJob[] {
  const jobs: RawJob[] = [];
  for (const j of body.jobs ?? []) {
    const guid = j.guid ?? j.applicationLink;
    if (!guid || !j.title) continue;
    // Link back to the Himalayas listing (their terms), not straight to the employer.
    const url = /^https?:\/\//.test(guid) ? guid : j.applicationLink ?? "";
    if (!url) continue;
    jobs.push({
      source: "himalayas",
      external_id: guid,
      title: j.title.trim(),
      company: (j.companyName ?? "").trim(),
      url,
      description: stripHtml(j.description || j.excerpt),
      region_text: regionText(j) + timezoneText(j),
      posted_at: toIsoOrNull(j.pubDate),
      salary_text: salaryText(j),
    });
  }
  return jobs;
}

function salaryText(j: HimalayasJob): string | null {
  if (!j.minSalary && !j.maxSalary) return null;
  const cur = j.currency ?? "USD";
  const range =
    j.minSalary && j.maxSalary && j.minSalary !== j.maxSalary
      ? `${j.minSalary.toLocaleString()}–${j.maxSalary.toLocaleString()}`
      : (j.minSalary || j.maxSalary)!.toLocaleString();
  return `${cur} ${range}${j.salaryPeriod ? ` per ${j.salaryPeriod}` : ""}`;
}

export const himalayas: JobSource = {
  id: "himalayas",
  name: "Himalayas",
  homepage: "https://himalayas.app",
  minIntervalMinutes: 12 * 60,
  async fetchJobs() {
    const jobs: RawJob[] = [];
    for (const q of QUERIES) {
      const res = await fetchWithTimeout(
        `https://himalayas.app/jobs/api/search?q=${encodeURIComponent(q)}&country=Nigeria`
      );
      if (res.status === 429) break; // respect their rate limit; try again next run
      if (!res.ok) throw new Error(`Himalayas ${res.status}`);
      jobs.push(...mapHimalayasJobs((await res.json()) as { jobs?: HimalayasJob[] }));
    }
    return jobs;
  },
};
