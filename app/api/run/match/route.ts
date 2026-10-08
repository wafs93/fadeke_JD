import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { matchBatchSize, runMatchForUser } from "@/lib/match";
import { runNgAiChecks } from "@/lib/ng-ai";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

/** "Score new jobs" button. Runs as the signed-in user (RLS applies). */
export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Location checks write to the shared jobs table, so they use the service role.
  const ai = await runNgAiChecks(createAdminClient(), 15, Date.now() + 15_000);
  return NextResponse.json({ ai, ...(await runMatchForUser(supabase, user.id, matchBatchSize())) });
}
