import type { JobSource } from "@/lib/sources/types";
import type { RawJob } from "@/lib/types";
import { fetchWithTimeout, stripHtml, toIsoOrNull } from "@/lib/util";

// Public API: https://himalayas.app/jobs/api/search
// Terms: link back to the Himalayas URL and name Himalayas as the source.
// Data refreshes every 24 hours, so we fetch at most every 12 hours.
const QUERIES = ["virtual assistant", "executive assistant", "administrative assistant", "customer support"];

interface HimalayasJob {
  title?: string;
  companyName?: string;
  guid?: string;
  applicationLink?: string;
  locationRestrictions?: Array<string | { name?: string }>;
  timezoneRestriction?: unknown;
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
  return names.length ? names.join(", ") : "Worldwide";
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
      const res = await fetchWithTimeout(`https://himalayas.app/jobs/api/search?q=${encodeURIComponent(q)}`);
      if (res.status === 429) break; // respect their rate limit; try again next run
      if (!res.ok) throw new Error(`Himalayas ${res.status}`);
      const body = (await res.json()) as { jobs?: HimalayasJob[] };
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
          region_text: regionText(j),
          posted_at: toIsoOrNull(j.pubDate),
          salary_text: salaryText(j),
        });
      }
    }
    return jobs;
  },
};
