"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { pasteInputSchema } from "@/lib/paste-input";
import { runPasteFlow, type PasteResult } from "@/lib/paste";
import { classifyUnclearJob } from "@/lib/ng-ai";
import { scoreAndSaveMatch } from "@/lib/match";
import { loadProfileBundle } from "@/lib/profile";
import { profileFactsText } from "@/lib/facts";
import { hasColumn } from "@/lib/db-columns";
import type { Match, ScamFlag } from "@/lib/types";

export type AddJobResponse = { ok: true; result: PasteResult } | { ok: false; error: string };

export async function addJob(formData: FormData): Promise<AddJobResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const parsed = pasteInputSchema.safeParse({
    text: formData.get("text") ?? "",
    link: formData.get("link") ?? "",
    company: formData.get("company") ?? "",
    source: formData.get("source") ?? "",
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form and try again." };

  // jobs is written only by the server (service role); the row is tagged
  // with her user id and RLS keeps it private to her.
  const admin = createAdminClient();
  if (!(await hasColumn(admin, "jobs", "owner_id"))) {
    return { ok: false, error: "The database needs one more update first (migration 003). Ask whoever set up the desk to run it." };
  }

  try {
    const result = await runPasteFlow(parsed.data, user.id, {
      aiAvailable: Boolean(process.env.OPENAI_API_KEY),

      async findExisting(userId, hash) {
        const { data: job } = await admin
          .from("jobs")
          .select("id, title, ng_eligible, ng_reason, ng_evidence, ng_method, scam_level, scam_score, scam_flags")
          .eq("owner_id", userId)
          .eq("content_hash", hash)
          .maybeSingle();
        if (!job) return null;
        const { data: m } = await supabase.from("matches").select("*").eq("user_id", userId).eq("job_id", job.id).maybeSingle();
        const match = m as Match | null;
        return {
          jobId: job.id,
          duplicate: true,
          title: job.title,
          eligible: job.ng_eligible,
          ngReason: job.ng_reason ?? "",
          ngEvidence: job.ng_evidence ?? null,
          ngMethod: job.ng_method === "ai" ? "ai" : "rules",
          scamLevel: job.scam_level,
          scamScore: job.scam_score,
          scamFlags: (job.scam_flags as ScamFlag[]) ?? [],
          score: match?.score ?? null,
          reasons: match?.reasons ?? [],
          have: match?.have ?? [],
          gaps: match?.gaps ?? [],
          scoreNote: match ? null : "Not scored.",
        };
      },

      classifyUnclear: classifyUnclearJob,

      async insertJob(row) {
        const { data, error } = await admin
          .from("jobs")
          .insert({ ...row, ng_checked_at: new Date().toISOString() })
          .select("id")
          .single();
        if (error) throw new Error(`saving the post: ${error.message}`);
        return data.id as string;
      },

      async score(job) {
        const bundle = await loadProfileBundle(supabase, user.id);
        if (!bundle.profile) return null;
        return scoreAndSaveMatch(supabase, user.id, profileFactsText(bundle), job);
      },
    });

    revalidatePath("/");
    revalidatePath("/jobs/add");
    return { ok: true, result };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
