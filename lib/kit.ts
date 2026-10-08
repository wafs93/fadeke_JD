import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { chatJson } from "@/lib/openai";
import { loadProfileBundle, type ProfileBundle } from "@/lib/profile";
import { profileFactsText } from "@/lib/facts";
import type { Experience, Job, Kit } from "@/lib/types";
import { formatDateRange } from "@/lib/util";

const kitSchema = z.object({
  summary: z.string(),
  skills: z.array(z.string()),
  bullet_order: z.array(z.object({ id: z.string(), order: z.array(z.number().int()) })),
  cover_letter: z.string(),
  answers: z.array(z.object({ question: z.string(), answer: z.string() })).max(6),
});

type KitDraft = z.infer<typeof kitSchema>;

const SYSTEM_PROMPT = `You prepare a job application kit for one job seeker. She will read, edit and submit it herself.

ABSOLUTE RULES
1. Use ONLY facts written in PROFILE. Do not invent or embellish employers, dates, duties, numbers, results, tools, certifications, software, years of experience or personal details.
2. If something the job asks for is not in PROFILE, do not claim it. Where a sentence truly needs a missing detail, write a visible placeholder in square brackets, e.g. [add rate], [add example of travel booking], [add portfolio link].
3. If the minimum hourly rate is "[not given]", any answer about pay must use [add rate].
4. Never mention UNCONFIRMED EXPERIENCE employers or describe their work.
5. Plain, warm, professional English. No clichés like "I am writing to express my interest". No exclamation marks.

RETURN JSON:
{
  "summary": "2-3 sentence CV summary tailored to this job, using only PROFILE facts",
  "skills": ["up to 12 items copied exactly from PROFILE Skills or Tools, most relevant first"],
  "bullet_order": [{"id": "<confirmed experience id>", "order": [indexes of that role's bullets, most relevant to this job first]}],
  "cover_letter": "Full cover letter, 180-260 words. Start with 'Dear Hiring Manager,' (or the named person if the post names one). End with 'Kind regards,' then a new line with her name. No address block.",
  "answers": [{"question": "...", "answer": "..."}]
}

For "answers": write 3-5 short answers (40-90 words each) to questions this application is likely to ask: any questions the post itself asks, plus her availability/timezone, pay expectations, and why this role. Answers follow the same rules.`;

export async function draftKit(bundle: ProfileBundle, job: Job): Promise<KitDraft> {
  const user = `PROFILE:
${profileFactsText(bundle)}

JOB:
Title: ${job.title}
Company: ${job.company || "(not named)"}
Location rules: ${job.region_text || "(not stated)"}
Pay: ${job.salary_text || "(not stated)"}
Description:
${job.description.slice(0, 8000)}`;
  return chatJson(SYSTEM_PROMPT, user, (raw) => kitSchema.safeParse(raw), 0.4);
}

function byStartDesc(a: Experience, b: Experience): number {
  if (a.current !== b.current) return a.current ? -1 : 1;
  return (b.start_date ?? "").localeCompare(a.start_date ?? "");
}

/** Builds the CV text from saved, confirmed facts. The model only chooses the
 * order of existing duties, which listed skills to show, and the summary. */
export function composeCv(bundle: ProfileBundle, draft: Pick<KitDraft, "summary" | "skills" | "bullet_order">): string {
  const p = bundle.profile;
  const lines: string[] = [];

  lines.push(p?.full_name || "[add full name]");
  lines.push(
    [p?.location || "[add location]", p?.email || "[add email]", p?.phone || "[add phone]", p?.timezone]
      .filter(Boolean)
      .join(" · ")
  );

  lines.push("", "## Profile", draft.summary.trim() || p?.summary || "[add summary]");

  // Only skills that really are in the profile, whatever the model returned.
  const known = new Map([...(p?.skills ?? []), ...(p?.tools ?? [])].map((s) => [s.toLowerCase(), s]));
  const skills = draft.skills.map((s) => known.get(s.trim().toLowerCase())).filter((s): s is string => Boolean(s));
  const finalSkills = Array.from(new Set(skills.length ? skills : Array.from(known.values()))).slice(0, 12);
  if (finalSkills.length) lines.push("", "## Skills", finalSkills.join(" · "));

  const confirmed = bundle.experiences.filter((e) => e.verified).sort(byStartDesc);
  if (confirmed.length) {
    lines.push("", "## Experience");
    for (const e of confirmed) {
      lines.push(`### ${e.title}, ${e.employer}`);
      const meta = [formatDateRange(e.start_date, e.end_date, e.current), e.remote ? "Remote" : e.location]
        .filter(Boolean)
        .join(" · ");
      if (meta) lines.push(meta);
      const wanted = draft.bullet_order.find((b) => b.id === e.id)?.order ?? [];
      const valid = wanted.filter((i, pos) => i >= 0 && i < e.bullets.length && wanted.indexOf(i) === pos);
      const order = [...valid, ...e.bullets.map((_, i) => i).filter((i) => !valid.includes(i))];
      for (const i of order) lines.push(`- ${e.bullets[i].text}`);
    }
  }

  if (bundle.education.length) {
    lines.push("", "## Education");
    for (const ed of bundle.education) {
      const years = [ed.start_year, ed.end_year].filter(Boolean).join(" – ");
      lines.push(`- ${[ed.degree, ed.field].filter(Boolean).join(" ")}, ${ed.school}${years ? ` (${years})` : ""}`);
    }
  }

  if (p?.languages?.length) lines.push("", "## Languages", p.languages.join(" · "));

  return lines.join("\n");
}

export function formatAnswers(answers: KitDraft["answers"]): string {
  return answers.map((a) => `Q: ${a.question.trim()}\nA: ${a.answer.trim()}`).join("\n\n");
}

export async function buildKitForJob(supabase: SupabaseClient, userId: string, jobId: string): Promise<Kit> {
  const [bundle, jobRes] = await Promise.all([
    loadProfileBundle(supabase, userId),
    supabase.from("jobs").select("*").eq("id", jobId).single(),
  ]);
  if (!bundle.profile) throw new Error("Your profile is empty. Fill in the Profile page first.");
  if (jobRes.error || !jobRes.data) throw new Error("Job not found");
  const job = jobRes.data as Job;

  const draft = await draftKit(bundle, job);
  const name = bundle.profile.full_name || "[add full name]";
  let cover = draft.cover_letter.trim();
  if (!cover.includes(name) && bundle.profile.full_name) cover = `${cover}\n${name}`;

  const { data, error } = await supabase
    .from("kits")
    .insert({
      user_id: userId,
      job_id: jobId,
      cv_text: composeCv(bundle, draft),
      cover_letter: cover,
      answers_text: formatAnswers(draft.answers),
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as Kit;
}

export async function loadLatestKit(supabase: SupabaseClient, userId: string, jobId: string): Promise<Kit | null> {
  const { data } = await supabase
    .from("kits")
    .select("*")
    .eq("user_id", userId)
    .eq("job_id", jobId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as Kit | null) ?? null;
}
