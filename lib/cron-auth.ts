import { NextRequest, NextResponse } from "next/server";

/** /api/cron/* routes accept only the shared CRON_SECRET bearer token (Vercel
 * Cron sends it automatically). The in-app buttons call /api/run/* routes,
 * which check the session cookie instead — see lib/run-auth.ts. */
export function requireCronAuth(request: NextRequest): NextResponse | null {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`) {
    return null;
  }
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
