import type { JobSource } from "@/lib/sources/types";
import type { RawJob } from "@/lib/types";
import { fetchWithTimeout, stripHtml, toIsoOrNull } from "@/lib/util";

// Public JSON feed linked as "API" in Working Nomads' own site footer:
// https://www.workingnomads.com/api/exposed_jobs/
// Their terms have no clause against automated access or reuse; robots.txt
// allows everything. One request per run, at most every 6 hours, and every
// job links back to its Working Nomads listing.

interface WorkingNomadsJob {
  url: string;
  title: string;
  description?: string;
  company_name?: string;
  category_name?: string;
  tags?: string;
  location?: string;
  pub_date?: string;
}

export function mapWorkingNomads(body: WorkingNomadsJob[]): RawJob[] {
  return (Array.isArray(body) ? body : [])
    .filter((j) => j?.url && j.title)
    .map((j) => ({
      source: "workingnomads",
      external_id: j.url,
      title: j.title.trim(),
      company: (j.company_name ?? "").trim(),
      url: j.url,
      description: stripHtml(j.description),
      region_text: (j.location ?? "").replace(/\s+/g, " ").trim(),
      posted_at: toIsoOrNull(j.pub_date),
      salary_text: null,
    }));
}

export const workingnomads: JobSource = {
  id: "workingnomads",
  name: "Working Nomads",
  homepage: "https://www.workingnomads.com",
  minIntervalMinutes: 6 * 60,
  async fetchJobs() {
    const res = await fetchWithTimeout("https://www.workingnomads.com/api/exposed_jobs/", {}, 25000);
    if (!res.ok) throw new Error(`Working Nomads ${res.status}`);
    return mapWorkingNomads((await res.json()) as WorkingNomadsJob[]);
  },
};
