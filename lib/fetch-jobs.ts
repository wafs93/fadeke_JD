import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { enabledSources } from "@/lib/sources";
import { isRelevantTitle } from "@/lib/relevance";
import { checkNigeriaEligibility } from "@/lib/eligibility";
import { assessScam } from "@/lib/scam";
import type { RawJob } from "@/lib/types";

const MAX_AGE_DAYS = 30;

export interface SourceSummary {
  source: string;
  status: "ok" | "skipped" | "error";
  fetched: number;
  kept: number;
  message?: string;
}

/** Adds eligibility and scam fields to a raw job, ready to upsert. */
export function enrichJob(job: RawJob) {
  const ng = checkNigeriaEligibility(job.region_text, job.description, job.title);
  const scam = assessScam(job);
  return {
    ...job,
    description: job.description.slice(0, 20000),
    ng_eligible: ng.eligible,
    ng_reason: ng.reason,
    scam_score: scam.score,
    scam_flags: scam.flags,
    scam_level: scam.level,
    fetched_at: new Date().toISOString(),
  };
}

/**
 * Fetches every enabled source that is not inside its rate-limit window,
 * keeps relevant recent VA-type roles, and upserts them into the shared jobs
 * table. Uses the service role (jobs are not per-user).
 */
export async function runFetch(): Promise<{ ok: boolean; sources: SourceSummary[] }> {
  const admin = createAdminClient();
  const sources = enabledSources();

  const [{ data: runs }, { data: profiles }] = await Promise.all([
    admin.from("source_runs").select("source, last_run_at"),
    admin.from("profiles").select("target_titles"),
  ]);

  const lastRun = new Map<string, number>(
    (runs ?? []).map((r: { source: string; last_run_at: string }) => [r.source, new Date(r.last_run_at).getTime()])
  );
  const extraTitles = Array.from(
    new Set((profiles ?? []).flatMap((p: { target_titles: string[] | null }) => p.target_titles ?? []))
  );
  const cutoff = Date.now() - MAX_AGE_DAYS * 86_400_000;

  const results = await Promise.all(
    sources.map(async (source): Promise<SourceSummary> => {
      const last = lastRun.get(source.id);
      if (last && Date.now() - last < source.minIntervalMinutes * 60_000) {
        const mins = Math.round((Date.now() - last) / 60_000);
        return {
          source: source.id,
          status: "skipped",
          fetched: 0,
          kept: 0,
          message: `Fetched ${mins} min ago; ${source.name} allows one fetch every ${Math.round(source.minIntervalMinutes / 60)}h`,
        };
      }

      try {
        const raw = await source.fetchJobs();
        const seen = new Set<string>();
        const kept = raw.filter((j) => {
          if (seen.has(j.external_id)) return false;
          seen.add(j.external_id);
          if (j.posted_at && new Date(j.posted_at).getTime() < cutoff) return false;
          return isRelevantTitle(j.title, extraTitles);
        });

        if (kept.length) {
          const { error } = await admin
            .from("jobs")
            .upsert(kept.map(enrichJob), { onConflict: "source,external_id" });
          if (error) throw new Error(`saving jobs: ${error.message}`);
        }

        await admin.from("source_runs").upsert({
          source: source.id,
          last_run_at: new Date().toISOString(),
          last_status: "ok",
          last_count: kept.length,
          last_error: null,
        });
        return { source: source.id, status: "ok", fetched: raw.length, kept: kept.length };
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        // Record the attempt too, so a failing source is not hammered.
        await admin.from("source_runs").upsert({
          source: source.id,
          last_run_at: new Date().toISOString(),
          last_status: "error",
          last_count: 0,
          last_error: message.slice(0, 500),
        });
        return { source: source.id, status: "error", fetched: 0, kept: 0, message };
      }
    })
  );

  return { ok: results.every((r) => r.status !== "error"), sources: results };
}
