import type { JobSource } from "@/lib/sources/types";
import type { RawJob } from "@/lib/types";
import { decodeEntities, fetchWithTimeout, stripHtml, toIsoOrNull } from "@/lib/util";

// Public RSS feeds: https://weworkremotely.com/remote-job-rss-feed
// We link back to each We Work Remotely listing and name the source.
const FEEDS = [
  "https://weworkremotely.com/categories/remote-customer-support-jobs.rss",
  "https://weworkremotely.com/categories/all-other-remote-jobs.rss",
  "https://weworkremotely.com/categories/remote-sales-and-marketing-jobs.rss",
];

function tag(item: string, name: string): string {
  const m = item.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  if (!m) return "";
  return m[1].replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, "$1").trim();
}

export function parseWwrRss(xml: string): RawJob[] {
  const jobs: RawJob[] = [];
  const items = xml.match(/<item>[\s\S]*?<\/item>/gi) ?? [];
  for (const item of items) {
    const rawTitle = decodeEntities(tag(item, "title"));
    const link = decodeEntities(tag(item, "link"));
    const guid = decodeEntities(tag(item, "guid")) || link;
    if (!rawTitle || !link) continue;
    // Titles look like "Company Name: Job Title".
    const sep = rawTitle.indexOf(": ");
    const company = sep > 0 ? rawTitle.slice(0, sep).trim() : "";
    const title = sep > 0 ? rawTitle.slice(sep + 2).trim() : rawTitle.trim();
    const region = [tag(item, "region"), tag(item, "country")].filter(Boolean).map(decodeEntities).join(" · ");
    jobs.push({
      source: "weworkremotely",
      external_id: guid,
      title,
      company,
      url: link,
      description: stripHtml(tag(item, "description")),
      region_text: region,
      posted_at: toIsoOrNull(tag(item, "pubDate")),
      salary_text: null,
    });
  }
  return jobs;
}

export const weworkremotely: JobSource = {
  id: "weworkremotely",
  name: "We Work Remotely",
  homepage: "https://weworkremotely.com",
  minIntervalMinutes: 3 * 60,
  async fetchJobs() {
    const jobs: RawJob[] = [];
    for (const feed of FEEDS) {
      const res = await fetchWithTimeout(feed);
      if (!res.ok) throw new Error(`We Work Remotely ${res.status}`);
      jobs.push(...parseWwrRss(await res.text()));
    }
    return jobs;
  },
};
