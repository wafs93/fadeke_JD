import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { matchBatchSize, runMatchForUser } from "@/lib/match";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

/** "Score new jobs" button. Runs as the signed-in user (RLS applies). */
export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await runMatchForUser(supabase, user.id, matchBatchSize()));
}
