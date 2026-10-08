import type { JobSource } from "@/lib/sources/types";
import type { RawJob } from "@/lib/types";
import { fetchWithTimeout, stripHtml, toIsoOrNull } from "@/lib/util";

// Public API: https://jobicy.com/api/v2/remote-jobs
// Terms: keep Jobicy as the source and link to the canonical Jobicy URL.
// Guidance: no more than one automated pass per hour; we use 6 hours.
const TAGS = ["assistant", "customer support", "data entry"];

interface JobicyJob {
  id: number;
  url: string;
  jobTitle: string;
  companyName?: string;
  jobGeo?: string;
  jobDescription?: string;
  jobExcerpt?: string;
  pubDate?: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  salaryPeriod?: string;
  annualSalaryMin?: number;
  annualSalaryMax?: number;
}

function salaryText(j: JobicyJob): string | null {
  const min = j.salaryMin ?? j.annualSalaryMin;
  const max = j.salaryMax ?? j.annualSalaryMax;
  if (!min && !max) return null;
  const cur = j.salaryCurrency ?? "USD";
  const period = j.salaryPeriod ? ` per ${j.salaryPeriod.replace(/ly$/, "")}` : j.annualSalaryMin ? " a year" : "";
  const range = min && max && min !== max ? `${min.toLocaleString()}–${max.toLocaleString()}` : (min || max)!.toLocaleString();
  return `${cur} ${range}${period}`;
}

export const jobicy: JobSource = {
  id: "jobicy",
  name: "Jobicy",
  homepage: "https://jobicy.com",
  minIntervalMinutes: 6 * 60,
  async fetchJobs() {
    const jobs: RawJob[] = [];
    for (const t of TAGS) {
      const res = await fetchWithTimeout(
        `https://jobicy.com/api/v2/remote-jobs?count=50&tag=${encodeURIComponent(t)}`
      );
      if (!res.ok) throw new Error(`Jobicy ${res.status}`);
      const body = (await res.json()) as { jobs?: JobicyJob[] };
      for (const j of body.jobs ?? []) {
        if (!j?.id || !j.url || !j.jobTitle) continue;
        jobs.push({
          source: "jobicy",
          external_id: String(j.id),
          title: stripHtml(j.jobTitle),
          company: (j.companyName ?? "").trim(),
          url: j.url,
          description: stripHtml(j.jobDescription || j.jobExcerpt),
          region_text: (j.jobGeo ?? "").trim(),
          posted_at: toIsoOrNull(j.pubDate),
          salary_text: salaryText(j),
        });
      }
    }
    return jobs;
  },
};
