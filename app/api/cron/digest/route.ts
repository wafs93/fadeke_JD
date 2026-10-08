import { NextRequest, NextResponse } from "next/server";
import { requireCronAuth } from "@/lib/cron-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { escapeHtml, sendTelegramMessage, telegramEnabled } from "@/lib/telegram";
import { todayInLagos } from "@/lib/util";

export const maxDuration = 30;
export const dynamic = "force-dynamic";

const MIN_SCORE = 60;

/** Daily Telegram digest: new strong matches and follow-ups due. Off unless
 * TELEGRAM_ENABLED=true. Sent to one chat (TELEGRAM_CHAT_ID), so it is
 * meant for this single-user desk. */
export async function GET(request: NextRequest) {
  const unauthorized = requireCronAuth(request);
  if (unauthorized) return unauthorized;
  if (!telegramEnabled()) return NextResponse.json({ skipped: "Telegram digest is turned off" });

  const admin = createAdminClient();
  const since = new Date(Date.now() - 24 * 3_600_000).toISOString();
  const today = todayInLagos();
  const appUrl = (process.env.APP_URL ?? "").replace(/\/$/, "");

  const { data: profiles } = await admin.from("profiles").select("user_id");
  const sent: string[] = [];

  for (const { user_id } of profiles ?? []) {
    const [{ data: matches }, { data: due }] = await Promise.all([
      admin
        .from("matches")
        .select("score, job:jobs(id, title, company, ng_eligible, scam_level)")
        .eq("user_id", user_id)
        .gte("created_at", since)
        .gte("score", MIN_SCORE)
        .order("score", { ascending: false })
        .limit(8),
      admin
        .from("applications")
        .select("follow_up_on, job:jobs(title, company)")
        .eq("user_id", user_id)
        .in("stage", ["Applied", "Replied"])
        .lte("follow_up_on", today),
    ]);

    type JobLite = { id: string; title: string; company: string; ng_eligible: boolean | null; scam_level: string };
    const good = (matches ?? [])
      .map((m) => ({ score: m.score as number, job: (Array.isArray(m.job) ? m.job[0] : m.job) as JobLite | null }))
      .filter((m) => m.job && m.job.ng_eligible !== false && m.job.scam_level !== "high");

    if (!good.length && !(due ?? []).length) continue;

    const lines: string[] = ["<b>Fadeke's Job Desk: today</b>"];
    if (good.length) {
      lines.push("", `<b>${good.length} new good matches</b>`);
      for (const m of good) {
        const label = `${m.score} · ${escapeHtml(m.job!.title)}${m.job!.company ? ` at ${escapeHtml(m.job!.company)}` : ""}`;
        lines.push(appUrl ? `• <a href="${appUrl}/?job=${m.job!.id}">${label}</a>` : `• ${label}`);
      }
    }
    if ((due ?? []).length) {
      lines.push("", "<b>Follow-ups due</b>");
      for (const d of due ?? []) {
        const job = (Array.isArray(d.job) ? d.job[0] : d.job) as { title: string; company: string } | null;
        if (job) lines.push(`• ${escapeHtml(job.company || job.title)}`);
      }
    }
    lines.push("", "Nothing is sent to employers. Open the desk to build kits and apply yourself.");

    await sendTelegramMessage(lines.join("\n"));
    sent.push(user_id);
  }

  return NextResponse.json({ sent: sent.length });
}
