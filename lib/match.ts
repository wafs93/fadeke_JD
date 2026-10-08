import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { chatJson } from "@/lib/openai";
import { loadProfileBundle } from "@/lib/profile";
import { profileFactsText } from "@/lib/facts";
import type { Job } from "@/lib/types";

const matchSchema = z.object({
  score: z.number().min(0).max(100),
  reasons: z.array(z.string()).max(5),
  have: z.array(z.string()).max(8),
  gaps: z.array(z.string()).max(8),
});

export type MatchResult = z.infer<typeof matchSchema>;

const SYSTEM_PROMPT = `You compare one job seeker's profile with one remote job post and score the fit.

Rules:
- Use ONLY the facts in PROFILE. Never assume skills, tools, years or results that are not written there.
- Unconfirmed experience counts only as "has held that job title"; never credit duties for it.
- Score 0-100: required skills and duties 45, tools 15, experience level 20, practical fit (timezone, hours, language, location rules) 20.
- The job has already been checked as open to applicants in Nigeria. If you still see a location rule that excludes Nigeria, score no higher than 20 and say why in gaps.
- "reasons": 2-4 short sentences (under 20 words) on why this is or is not a good fit.
- "have": requirements from the post that PROFILE clearly meets, each naming the profile fact (for example "Calendar management: manages founder's calendar at Oluya Imagery").
- "gaps": requirements from the post that PROFILE does not show. Plain, kind wording.

Reply with JSON only: {"score":0,"reasons":["..."],"have":["..."],"gaps":["..."]}`;

export async function scoreJob(facts: string, job: Pick<Job, "title" | "company" | "region_text" | "description" | "salary_text">): Promise<MatchResult> {
  const user = `PROFILE:
${facts}

JOB:
Title: ${job.title}
Company: ${job.company || "(not given)"}
Location rules: ${job.region_text || "(not stated)"}
Pay: ${job.salary_text || "(not stated)"}
Description:
${job.description.slice(0, 7000)}`;
  const result = await chatJson(SYSTEM_PROMPT, user, (raw) => matchSchema.safeParse(raw), 0.2);
  return { ...result, score: Math.round(result.score) };
}

export interface MatchRunSummary {
  scored: number;
  remaining: number;
  errors: string[];
}

/**
 * Scores up to `limit` unscored jobs for one user, newest first. Only jobs
 * marked open to Nigeria are scored, and high scam risk ones are skipped. Works with either the user's own client (RLS) or the admin client.
 */
export async function runMatchForUser(supabase: SupabaseClient, userId: string, limit: number): Promise<MatchRunSummary> {
  const bundle = await loadProfileBundle(supabase, userId);
  if (!bundle.profile) return { scored: 0, remaining: 0, errors: ["Profile is empty. Fill in the Profile page first."] };
  const facts = profileFactsText(bundle);

  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const [{ data: jobs, error: jobsError }, { data: matched }] = await Promise.all([
    supabase
      .from("jobs")
      .select("id, title, company, region_text, description, salary_text, ng_eligible, scam_level, posted_at")
      // Only jobs she can apply for from Nigeria; never pay to score the rest.
      .eq("ng_eligible", true)
      .neq("scam_level", "high")
      .gte("fetched_at", since)
      .order("posted_at", { ascending: false, nullsFirst: false })
      .limit(500),
    supabase.from("matches").select("job_id").eq("user_id", userId),
  ]);
  if (jobsError) return { scored: 0, remaining: 0, errors: [jobsError.message] };

  const done = new Set((matched ?? []).map((m: { job_id: string }) => m.job_id));
  const todo = (jobs ?? []).filter((j: { id: string }) => !done.has(j.id)) as Job[];
  const batch = todo.slice(0, limit);
  const errors: string[] = [];
  let scored = 0;

  for (const job of batch) {
    try {
      const result = await scoreJob(facts, job);
      const { error } = await supabase.from("matches").upsert(
        {
          user_id: userId,
          job_id: job.id,
          score: result.score,
          reasons: result.reasons,
          have: result.have,
          gaps: result.gaps,
          created_at: new Date().toISOString(),
        },
        { onConflict: "user_id,job_id" }
      );
      if (error) throw new Error(error.message);
      scored++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${job.title}: ${msg}`);
      if (/^OpenAI: (401|403|429)/.test(msg)) break; // will fail the same way for every job
    }
  }

  return { scored, remaining: Math.max(0, todo.length - scored), errors };
}

export function matchBatchSize(): number {
  const n = Number(process.env.MATCH_BATCH_SIZE);
  return Number.isInteger(n) && n > 0 && n <= 50 ? n : 15;
}
