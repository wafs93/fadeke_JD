import type { JobSource } from "@/lib/sources/types";
import { remotive } from "@/lib/sources/remotive";
import { remoteok } from "@/lib/sources/remoteok";
import { weworkremotely } from "@/lib/sources/weworkremotely";
import { jobicy } from "@/lib/sources/jobicy";
import { himalayas } from "@/lib/sources/himalayas";

// Only official APIs and public RSS feeds. No LinkedIn, Indeed or other sites
// whose terms forbid automated access.
export const ALL_SOURCES: JobSource[] = [remotive, remoteok, weworkremotely, jobicy, himalayas];

/** Sources enabled by JOB_SOURCES (comma-separated ids); all when blank. */
export function enabledSources(): JobSource[] {
  const wanted = (process.env.JOB_SOURCES ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return wanted.length ? ALL_SOURCES.filter((s) => wanted.includes(s.id)) : ALL_SOURCES;
}
