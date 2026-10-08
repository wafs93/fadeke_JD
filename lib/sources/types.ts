import type { RawJob } from "@/lib/types";

export interface JobSource {
  id: string;
  name: string;
  homepage: string;
  /** Minimum minutes between fetches, from each provider's usage guidance. */
  minIntervalMinutes: number;
  fetchJobs(): Promise<RawJob[]>;
}
