import { NextRequest, NextResponse } from "next/server";
import { requireCronAuth } from "@/lib/cron-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { matchBatchSize, runMatchForUser } from "@/lib/match";
import { runNgAiChecks } from "@/lib/ng-ai";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const unauthorized = requireCronAuth(request);
  if (unauthorized) return unauthorized;

  const admin = createAdminClient();
  // Settle "unclear" locations first, so newly confirmed open jobs get scored.
  const ai = await runNgAiChecks(admin, 20, Date.now() + 20_000);
  const { data: profiles, error } = await admin.from("profiles").select("user_id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const results = [];
  for (const p of profiles ?? []) {
    results.push({ user_id: p.user_id, ...(await runMatchForUser(admin, p.user_id, matchBatchSize())) });
  }
  return NextResponse.json({ ai, results, remaining: results.reduce((n, r) => n + r.remaining, 0) });
}
