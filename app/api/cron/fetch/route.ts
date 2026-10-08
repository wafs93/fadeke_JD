import { NextRequest, NextResponse } from "next/server";
import { requireCronAuth } from "@/lib/cron-auth";
import { runFetch } from "@/lib/fetch-jobs";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const unauthorized = requireCronAuth(request);
  if (unauthorized) return unauthorized;

  const result = await runFetch();
  return NextResponse.json(result, { status: result.ok ? 200 : 207 });
}
