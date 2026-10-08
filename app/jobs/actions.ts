"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { STAGES, type Stage } from "@/lib/types";
import { addDays, todayInLagos } from "@/lib/util";

type Result = { ok: true } | { ok: false; error: string };

const FOLLOW_UP_DAYS = 7;

async function requireUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  return { supabase, userId: user.id };
}

function fail(e: unknown): Result {
  return { ok: false, error: e instanceof Error ? e.message : String(e) };
}

function revalidateAll() {
  revalidatePath("/");
  revalidatePath("/tracker");
}

/** Adds the job to the tracker as Saved (leaves an existing card alone). */
export async function saveToTracker(jobId: string): Promise<Result> {
  try {
    const { supabase, userId } = await requireUser();
    const { error } = await supabase
      .from("applications")
      .upsert({ user_id: userId, job_id: jobId, stage: "Saved" }, { onConflict: "user_id,job_id", ignoreDuplicates: true });
    if (error) return { ok: false, error: error.message };
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Fadeke applied on the company's site herself; record it and set a follow-up date. */
export async function markApplied(jobId: string): Promise<Result> {
  try {
    const { supabase, userId } = await requireUser();
    const today = todayInLagos();
    const { error } = await supabase.from("applications").upsert(
      {
        user_id: userId,
        job_id: jobId,
        stage: "Applied",
        applied_on: today,
        follow_up_on: addDays(today, FOLLOW_UP_DAYS),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,job_id" }
    );
    if (error) return { ok: false, error: error.message };
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function updateApplication(
  id: string,
  patch: { stage?: Stage; applied_on?: string | null; follow_up_on?: string | null; notes?: string }
): Promise<Result> {
  try {
    const { supabase, userId } = await requireUser();
    if (patch.stage && !STAGES.includes(patch.stage)) return { ok: false, error: "Unknown stage" };
    const row: Record<string, unknown> = { ...patch, updated_at: new Date().toISOString() };
    if (patch.stage === "Applied" && patch.applied_on === undefined) {
      const { data } = await supabase.from("applications").select("applied_on").eq("id", id).single();
      if (!data?.applied_on) {
        const today = todayInLagos();
        row.applied_on = today;
        row.follow_up_on = addDays(today, FOLLOW_UP_DAYS);
      }
    }
    const { error } = await supabase.from("applications").update(row).eq("id", id).eq("user_id", userId);
    if (error) return { ok: false, error: error.message };
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function removeApplication(id: string): Promise<Result> {
  try {
    const { supabase, userId } = await requireUser();
    const { error } = await supabase.from("applications").delete().eq("id", id).eq("user_id", userId);
    if (error) return { ok: false, error: error.message };
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
