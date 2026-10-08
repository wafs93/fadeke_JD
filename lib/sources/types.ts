import type { RawJob } from "@/lib/types";

export interface JobSource {
  id: string;
  name: string;
  homepage: string;
  /** Minimum minutes between fetches, from each provider's usage guidance. */
  minIntervalMinutes: number;
  /** True for company job boards, which only list jobs that are still open,
   * so an old first-published date doesn't mean the job has closed. */
  listsOnlyOpenJobs?: boolean;
  fetchJobs(): Promise<RawJob[]>;
}
