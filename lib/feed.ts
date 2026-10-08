import type { SupabaseClient } from "@supabase/supabase-js";
import type { Application, Job, Match } from "@/lib/types";

export interface FeedItem {
  job: Job;
  match: Match | null;
  application: Application | null;
}

const FEED_DAYS = 30;

/**
 * Feed jobs. Only jobs open to Nigeria by default; with `includeUnclear`,
 * jobs whose location could not be confirmed are added. Jobs closed to
 * Nigeria and high scam risk jobs are never loaded.
 */
export async function loadFeed(supabase: SupabaseClient, userId: string, includeUnclear = false): Promise<FeedItem[]> {
  const since = new Date(Date.now() - FEED_DAYS * 86_400_000).toISOString();
  let jobsQuery = supabase
    .from("jobs")
    .select("*")
    .gte("fetched_at", since)
    .neq("scam_level", "high")
    .order("posted_at", { ascending: false, nullsFirst: false })
    .limit(400);
  jobsQuery = includeUnclear ? jobsQuery.or("ng_eligible.eq.true,ng_eligible.is.null") : jobsQuery.eq("ng_eligible", true);

  const [jobsRes, matchesRes, appsRes] = await Promise.all([
    jobsQuery,
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

/** How many recent jobs still need a location check (shown on the toggle). */
export async function countUnclear(supabase: SupabaseClient): Promise<number> {
  const since = new Date(Date.now() - FEED_DAYS * 86_400_000).toISOString();
  const { count } = await supabase
    .from("jobs")
    .select("id", { count: "exact", head: true })
    .is("ng_eligible", null)
    .neq("scam_level", "high")
    .gte("fetched_at", since);
  return count ?? 0;
}

/** The phrase that shows why a job is open: the stored evidence, or the
 * quote kept in ng_reason (before migration 002 adds ng_evidence). */
export function ngEvidence(job: { ng_evidence?: string | null; ng_reason: string | null }): string | null {
  if (job.ng_evidence) return job.ng_evidence;
  const m = job.ng_reason?.match(/"([^"]{2,200})"\s*(?:\(found by AI\))?$/);
  return m ? m[1] : null;
}
