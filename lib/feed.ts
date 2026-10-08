import type { SupabaseClient } from "@supabase/supabase-js";
import type { Application, Job, Match } from "@/lib/types";

export interface FeedItem {
  job: Job;
  match: Match | null;
  application: Application | null;
}

const FEED_DAYS = 30;

export async function loadFeed(supabase: SupabaseClient, userId: string): Promise<FeedItem[]> {
  const since = new Date(Date.now() - FEED_DAYS * 86_400_000).toISOString();
  const [jobsRes, matchesRes, appsRes] = await Promise.all([
    supabase
      .from("jobs")
      .select("*")
      .gte("fetched_at", since)
      .order("posted_at", { ascending: false, nullsFirst: false })
      .limit(400),
    supabase.from("matches").select("*").eq("user_id", userId),
    supabase.from("applications").select("*").eq("user_id", userId),
  ]);

  const matches = new Map(((matchesRes.data as Match[] | null) ?? []).map((m) => [m.job_id, m]));
  const apps = new Map(((appsRes.data as Application[] | null) ?? []).map((a) => [a.job_id, a]));

  return ((jobsRes.data as Job[] | null) ?? []).map((job) => ({
    job: { ...job, scam_flags: Array.isArray(job.scam_flags) ? job.scam_flags : [] },
    match: matches.get(job.id) ?? null,
    application: apps.get(job.id) ?? null,
  }));
}

export async function loadFeedItem(supabase: SupabaseClient, userId: string, jobId: string): Promise<FeedItem | null> {
  const [jobRes, matchRes, appRes] = await Promise.all([
    supabase.from("jobs").select("*").eq("id", jobId).maybeSingle(),
    supabase.from("matches").select("*").eq("user_id", userId).eq("job_id", jobId).maybeSingle(),
    supabase.from("applications").select("*").eq("user_id", userId).eq("job_id", jobId).maybeSingle(),
  ]);
  const job = jobRes.data as Job | null;
  if (!job) return null;
  return {
    job: { ...job, scam_flags: Array.isArray(job.scam_flags) ? job.scam_flags : [] },
    match: (matchRes.data as Match | null) ?? null,
    application: (appRes.data as Application | null) ?? null,
  };
}

export type FeedSort = "score" | "newest";

export function sortFeed(items: FeedItem[], sort: FeedSort): FeedItem[] {
  const copy = [...items];
  if (sort === "newest") {
    return copy.sort((a, b) => (b.job.posted_at ?? "").localeCompare(a.job.posted_at ?? ""));
  }
  return copy.sort((a, b) => {
    const sa = a.match?.score ?? -1;
    const sb = b.match?.score ?? -1;
    if (sb !== sa) return sb - sa;
    return (b.job.posted_at ?? "").localeCompare(a.job.posted_at ?? "");
  });
}

/** Hidden by default: closed to Nigeria, or high scam risk. */
export function isHiddenByDefault(item: FeedItem): boolean {
  return item.job.ng_eligible === false || item.job.scam_level === "high";
}
