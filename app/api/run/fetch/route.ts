import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { runFetch } from "@/lib/fetch-jobs";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

/** "Fetch new jobs" button. Same rate limits as the cron run. */
export async function POST() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await runFetch());
}
