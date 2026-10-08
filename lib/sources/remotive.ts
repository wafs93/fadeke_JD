import type { JobSource } from "@/lib/sources/types";
import type { RawJob } from "@/lib/types";
import { fetchWithTimeout, stripHtml, toIsoOrNull } from "@/lib/util";

// Public API: https://remotive.com/api/remote-jobs
// Terms: link back to the Remotive URL and name Remotive as the source. They
// ask for no more than a few requests a day; we make 2 requests per run and
// run at most every 12 hours.
const QUERIES = ["search=assistant", "category=customer-support"];

interface RemotiveJob {
  id: number;
  url: string;
  title: string;
  company_name: string;
  publication_date: string;
  candidate_required_location?: string;
  salary?: string;
  description?: string;
}

export const remotive: JobSource = {
  id: "remotive",
  name: "Remotive",
  homepage: "https://remotive.com",
  minIntervalMinutes: 12 * 60,
  async fetchJobs() {
    const jobs: RawJob[] = [];
    for (const q of QUERIES) {
      const res = await fetchWithTimeout(`https://remotive.com/api/remote-jobs?${q}&limit=100`);
      if (!res.ok) throw new Error(`Remotive ${res.status}`);
      const body = (await res.json()) as { jobs?: RemotiveJob[] };
      for (const j of body.jobs ?? []) {
        if (!j?.id || !j.url || !j.title) continue;
        jobs.push({
          source: "remotive",
          external_id: String(j.id),
          title: j.title.trim(),
          company: (j.company_name ?? "").trim(),
          url: j.url,
          description: stripHtml(j.description),
          region_text: (j.candidate_required_location ?? "").trim(),
          posted_at: toIsoOrNull(j.publication_date),
          salary_text: j.salary?.trim() || null,
        });
      }
    }
    return jobs;
  },
};
