"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { buildKitForJob } from "@/lib/kit";

type Result = { ok: true } | { ok: false; error: string };

export async function buildKit(jobId: string): Promise<Result> {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Not signed in" };
    await buildKitForJob(supabase, user.id, jobId);
    revalidatePath(`/jobs/${jobId}/kit`);
    revalidatePath("/");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function saveKit(
  kitId: string,
  jobId: string,
  texts: { cv_text: string; cover_letter: string; answers_text: string }
): Promise<Result> {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Not signed in" };
    const { error } = await supabase
      .from("kits")
      .update({ cv_text: texts.cv_text, cover_letter: texts.cover_letter, answers_text: texts.answers_text })
      .eq("id", kitId)
      .eq("user_id", user.id);
    if (error) return { ok: false, error: error.message };
    revalidatePath(`/jobs/${jobId}/kit`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
