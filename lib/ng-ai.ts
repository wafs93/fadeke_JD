import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { chatJson, MODEL_SMALL } from "@/lib/openai";
import { checkNigeriaEligibility, quoteSupportsOpen, statusToEligible, type Eligibility, type NgStatus } from "@/lib/eligibility";
import { mapWithConcurrency } from "@/lib/util";
import { hasColumn } from "@/lib/db-columns";

const verdictSchema = z.object({
  status: z.enum(["open", "closed", "unclear"]),
  quote: z.string().default(""),
  reason: z.string().default(""),
});

export type AiVerdict = z.infer<typeof verdictSchema>;

const SYSTEM_PROMPT = `You read one remote job post and decide if a person living in Lagos, Nigeria may apply.

Answer:
- "open" ONLY if the post explicitly allows Nigeria: it says worldwide, anywhere, global, all countries, Africa, Nigeria, or lists countries that include Nigeria.
- "closed" if the post explicitly limits who can apply in a way that excludes Nigeria (named countries/regions without Nigeria, residency, work authorisation, citizenship, visas, US or other non-African time zones required, on-site or hybrid).
- "unclear" in every other case, including "remote" with no location, or EMEA/Europe only.

Rules:
- Never guess. "Remote" alone is NOT open.
- "quote" must be copied word for word from the post (3-25 words) and must itself show the answer. If you cannot quote such words, answer "unclear" with an empty quote.

Reply with JSON only: {"status":"open|closed|unclear","quote":"...","reason":"one short sentence"}`;

function normalise(s: string): string {
  return s.toLowerCase().replace(/[“”"'‘’`]/g, "").replace(/\s+/g, " ").trim();
}

/**
 * Accepts the model's verdict only when its quote is really in the post and
 * really supports it. Anything else falls back to "unclear".
 */
export function validateAiVerdict(post: string, verdict: AiVerdict): Eligibility {
  const quote = verdict.quote.trim().replace(/^["'“”]+|["'“”]+$/g, "");
  const inPost = quote.length >= 3 && normalise(post).includes(normalise(quote));
  const unclear: Eligibility = {
    status: "unclear",
    eligible: null,
    reason: "AI could not find a clear location statement in the post",
    evidence: null,
  };
  if (verdict.status === "unclear" || !inPost) return unclear;

  if (verdict.status === "open") {
    if (!quoteSupportsOpen(quote)) return unclear;
    // The quote itself must not contain a restriction the rules would catch.
    const recheck = checkNigeriaEligibility("", quote);
    if (recheck.status === "closed") return { ...recheck, reason: `${recheck.reason} (found by AI)` };
    return { status: "open", eligible: true, reason: `AI found in the post: "${quote}"`, evidence: quote };
  }

  return { status: "closed", eligible: false, reason: `AI found in the post: "${quote}"`, evidence: quote };
}

export async function classifyUnclearJob(job: { title: string; company: string; region_text: string; description: string }): Promise<Eligibility> {
  const post = `Title: ${job.title}\nCompany: ${job.company || "(not named)"}\nLocation field: ${job.region_text || "(empty)"}\n\n${job.description.slice(0, 9000)}`;
  const verdict = await chatJson(SYSTEM_PROMPT, `JOB POST:\n${post}`, (raw) => verdictSchema.safeParse(raw), 0, MODEL_SMALL);
  return validateAiVerdict(post, verdict);
}

/** True once migration 002 (ng_evidence, ng_method, ng_checked_at) has run. */
export async function hasNgColumns(admin: SupabaseClient): Promise<boolean> {
  return hasColumn(admin, "jobs", "ng_method");
}

export interface AiCheckSummary {
  checked: number;
  open: number;
  closed: number;
  unclear: number;
  errors: string[];
  skipped?: string;
}

/**
 * Runs the small model over "unclear" jobs not yet checked by AI. Needs the
 * service-role client (jobs are written only by the server) and migration 002,
 * which records that a job was checked so it is never paid for twice.
 */
export async function runNgAiChecks(admin: SupabaseClient, limit = 30, deadline = Date.now() + 40_000): Promise<AiCheckSummary> {
  const summary: AiCheckSummary = { checked: 0, open: 0, closed: 0, unclear: 0, errors: [] };
  if (!process.env.OPENAI_API_KEY) return { ...summary, skipped: "OPENAI_API_KEY is not set" };
  if (!(await hasNgColumns(admin))) return { ...summary, skipped: "Run supabase/migrations/002_ng_evidence.sql first" };

  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { data, error } = await admin
    .from("jobs")
    .select("id, title, company, region_text, description")
    .is("ng_eligible", null)
    .or("ng_method.is.null,ng_method.neq.ai")
    .gte("fetched_at", since)
    .order("posted_at", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) return { ...summary, errors: [error.message] };

  await mapWithConcurrency(data ?? [], 4, async (job) => {
    if (Date.now() > deadline) return;
    try {
      const r = await classifyUnclearJob(job);
      const { error: upErr } = await admin
        .from("jobs")
        .update({
          ng_eligible: statusToEligible(r.status),
          ng_reason: r.reason,
          ng_evidence: r.evidence,
          ng_method: "ai",
          ng_checked_at: new Date().toISOString(),
        })
        .eq("id", job.id);
      if (upErr) throw new Error(upErr.message);
      summary.checked++;
      summary[r.status as NgStatus]++;
    } catch (e) {
      summary.errors.push(`${job.title}: ${e instanceof Error ? e.message : String(e)}`);
    }
  });

  return summary;
}
