"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { splitList } from "@/lib/util";

type Result = { ok: true } | { ok: false; error: string };

async function requireUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  return { supabase, userId: user.id };
}

function clean(value: FormDataEntryValue | null): string | null {
  const s = typeof value === "string" ? value.trim() : "";
  return s ? s : null;
}

export async function saveProfile(formData: FormData): Promise<Result> {
  try {
    const { supabase, userId } = await requireUser();
    const rateRaw = clean(formData.get("min_hourly_rate"));
    const rate = rateRaw === null ? null : Number(rateRaw);
    if (rate !== null && (!Number.isFinite(rate) || rate < 0)) {
      return { ok: false, error: "Minimum hourly rate must be a number, or left blank." };
    }

    const { error } = await supabase.from("profiles").upsert({
      user_id: userId,
      full_name: clean(formData.get("full_name")) ?? "",
      email: clean(formData.get("email")),
      phone: clean(formData.get("phone")),
      location: clean(formData.get("location")),
      timezone: clean(formData.get("timezone")) ?? "WAT, UTC+1",
      target_titles: splitList(String(formData.get("target_titles") ?? "")),
      min_hourly_rate: rate,
      summary: clean(formData.get("summary")) ?? "",
      skills: splitList(String(formData.get("skills") ?? "")),
      tools: splitList(String(formData.get("tools") ?? "")),
      languages: splitList(String(formData.get("languages") ?? "")),
      updated_at: new Date().toISOString(),
    });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/profile");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

const dateOrNull = z
  .string()
  .nullable()
  .transform((s) => (s && /^\d{4}-\d{2}(-\d{2})?$/.test(s) ? (s.length === 7 ? `${s}-01` : s) : null));

const experienceSchema = z.object({
  id: z.string().uuid().nullable(),
  employer: z.string().trim().min(1, "Employer is required"),
  title: z.string().trim().min(1, "Job title is required"),
  start_date: dateOrNull,
  end_date: dateOrNull,
  current: z.boolean(),
  location: z.string().trim().nullable(),
  remote: z.boolean(),
  verified: z.boolean(),
  sort_order: z.number().int(),
  bullets: z.array(z.object({ text: z.string().trim(), tags: z.array(z.string().trim()) })),
});

export type ExperienceInput = z.input<typeof experienceSchema>;

export async function saveExperience(input: ExperienceInput): Promise<Result & { id?: string }> {
  try {
    const { supabase, userId } = await requireUser();
    const parsed = experienceSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid experience" };
    const { id, ...rest } = parsed.data;
    const row = {
      ...rest,
      user_id: userId,
      location: rest.location || null,
      end_date: rest.current ? null : rest.end_date,
      bullets: rest.bullets
        .filter((b) => b.text)
        .map((b) => ({ text: b.text, tags: b.tags.filter(Boolean) })),
    };

    if (id) {
      const { error } = await supabase.from("experiences").update(row).eq("id", id).eq("user_id", userId);
      if (error) return { ok: false, error: error.message };
      revalidatePath("/profile");
      return { ok: true, id };
    }
    const { data, error } = await supabase.from("experiences").insert(row).select("id").single();
    if (error) return { ok: false, error: error.message };
    revalidatePath("/profile");
    return { ok: true, id: data.id as string };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function deleteExperience(id: string): Promise<Result> {
  try {
    const { supabase, userId } = await requireUser();
    const { error } = await supabase.from("experiences").delete().eq("id", id).eq("user_id", userId);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/profile");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

const yearOrNull = z
  .union([z.number(), z.string(), z.null()])
  .transform((v) => {
    const n = typeof v === "string" ? Number(v.trim()) : v;
    return n && Number.isInteger(n) && n > 1900 && n < 2100 ? n : null;
  });

const educationSchema = z.object({
  id: z.string().uuid().nullable(),
  school: z.string().trim().min(1, "School is required"),
  degree: z.string().trim(),
  field: z.string().trim(),
  start_year: yearOrNull,
  end_year: yearOrNull,
});

export type EducationInput = z.input<typeof educationSchema>;

export async function saveEducation(input: EducationInput): Promise<Result & { id?: string }> {
  try {
    const { supabase, userId } = await requireUser();
    const parsed = educationSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid education" };
    const { id, ...rest } = parsed.data;
    const row = { ...rest, user_id: userId };

    if (id) {
      const { error } = await supabase.from("education").update(row).eq("id", id).eq("user_id", userId);
      if (error) return { ok: false, error: error.message };
      revalidatePath("/profile");
      return { ok: true, id };
    }
    const { data, error } = await supabase.from("education").insert(row).select("id").single();
    if (error) return { ok: false, error: error.message };
    revalidatePath("/profile");
    return { ok: true, id: data.id as string };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function deleteEducation(id: string): Promise<Result> {
  try {
    const { supabase, userId } = await requireUser();
    const { error } = await supabase.from("education").delete().eq("id", id).eq("user_id", userId);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/profile");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
