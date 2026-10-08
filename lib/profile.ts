import type { SupabaseClient } from "@supabase/supabase-js";
import type { Education, Experience, Profile } from "@/lib/types";

export interface ProfileBundle {
  profile: Profile | null;
  experiences: Experience[];
  education: Education[];
}

export async function loadProfileBundle(supabase: SupabaseClient, userId: string): Promise<ProfileBundle> {
  const [profileRes, expRes, eduRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("experiences").select("*").eq("user_id", userId).order("sort_order").order("created_at"),
    supabase.from("education").select("*").eq("user_id", userId).order("end_year", { ascending: false }),
  ]);

  return {
    profile: (profileRes.data as Profile | null) ?? null,
    experiences: ((expRes.data as Experience[] | null) ?? []).map((e) => ({
      ...e,
      bullets: Array.isArray(e.bullets) ? e.bullets : [],
    })),
    education: (eduRes.data as Education[] | null) ?? [],
  };
}

/** Profile details the kit generator needs but that are missing. Each turns
 * into a visible [placeholder] in generated text. */
export function missingProfileDetails(bundle: ProfileBundle): string[] {
  const p = bundle.profile;
  const missing: string[] = [];
  if (!p) return ["the whole profile"];
  if (!p.full_name) missing.push("full name");
  if (!p.email) missing.push("email");
  if (!p.phone) missing.push("phone");
  if (!p.location) missing.push("location");
  if (p.min_hourly_rate === null || p.min_hourly_rate === undefined) missing.push("minimum hourly rate");
  return missing;
}
