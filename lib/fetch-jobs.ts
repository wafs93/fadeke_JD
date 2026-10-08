import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { enabledSources } from "@/lib/sources";
import { isRelevantTitle } from "@/lib/relevance";
import { checkNigeriaEligibility } from "@/lib/eligibility";
import { runNgAiChecks, type AiCheckSummary } from "@/lib/ng-ai";
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
    ng_evidence: ng.evidence,
    ng_method: "rules",
    ng_checked_at: new Date().toISOString(),
    scam_score: scam.score,
    scam_flags: scam.flags,
    scam_level: scam.level,
    fetched_at: new Date().toISOString(),
  };
}

type EnrichedJob = ReturnType<typeof enrichJob>;

const NG_EXTRA_COLUMNS = ["ng_evidence", "ng_method", "ng_checked_at"] as const;

/** Drops the migration-002 columns, for databases that don't have them yet. */
export function withoutNgExtras<T extends Record<string, unknown>>(row: T): Omit<T, (typeof NG_EXTRA_COLUMNS)[number]> {
  const copy: Record<string, unknown> = { ...row };
  for (const c of NG_EXTRA_COLUMNS) delete copy[c];
  return copy as Omit<T, (typeof NG_EXTRA_COLUMNS)[number]>;
}

export function isMissingColumnError(error: { code?: string; message?: string } | null): boolean {
  return Boolean(error && (error.code === "42703" || error.code === "PGRST204" || /column .* does not exist|could not find the .* column/i.test(error.message ?? "")));
}

type Admin = ReturnType<typeof createAdminClient>;

/**
 * Upserts jobs without undoing earlier AI decisions: when the rules still say
 * "unclear" for a job the small model has already read, its verdict is kept.
 */
export async function saveJobs(admin: Admin, source: string, rows: EnrichedJob[]): Promise<void> {
  const ids = rows.map((r) => r.external_id);
  const { data: existing, error: readErr } = await admin
    .from("jobs")
    .select("external_id, ng_eligible, ng_reason, ng_evidence, ng_method, ng_checked_at")
    .eq("source", source)
    .in("external_id", ids);

  let merged: Record<string, unknown>[] = rows;
  if (!readErr) {
    const prior = new Map((existing ?? []).map((e: { external_id: string }) => [e.external_id, e as Record<string, unknown>]));
    merged = rows.map((row) => {
      const old = prior.get(row.external_id);
      if (old && old.ng_method === "ai" && row.ng_eligible === null) {
        return { ...row, ng_eligible: old.ng_eligible, ng_reason: old.ng_reason, ng_evidence: old.ng_evidence, ng_method: "ai", ng_checked_at: old.ng_checked_at };
      }
      return row;
    });
  }

  let { error } = await admin.from("jobs").upsert(merged, { onConflict: "source,external_id" });
  if (isMissingColumnError(error)) {
    ({ error } = await admin.from("jobs").upsert(merged.map(withoutNgExtras), { onConflict: "source,external_id" }));
  }
  if (error) throw new Error(`saving jobs: ${error.message}`);
}

/**
 * Fetches every enabled source that is not inside its rate-limit window,
 * keeps relevant recent VA-type roles, and upserts them into the shared jobs
 * table. Uses the service role (jobs are not per-user).
 */
export async function runFetch(): Promise<{ ok: boolean; sources: SourceSummary[]; ai: AiCheckSummary }> {
  const started = Date.now();
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

        if (kept.length) await saveJobs(admin, source.id, kept.map(enrichJob));

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

  // Read new "unclear" posts with the small model while time allows (routes have 60s).
  const ai = await runNgAiChecks(admin, 30, started + 50_000);

  return { ok: results.every((r) => r.status !== "error"), sources: results, ai };
}
