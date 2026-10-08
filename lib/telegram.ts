import "server-only";
import { fetchWithTimeout } from "@/lib/util";

/** The digest only runs when TELEGRAM_ENABLED=true and both secrets are set. */
export function telegramEnabled(): boolean {
  return (
    process.env.TELEGRAM_ENABLED === "true" && Boolean(process.env.TELEGRAM_BOT_TOKEN) && Boolean(process.env.TELEGRAM_CHAT_ID)
  );
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function sendTelegramMessage(html: string): Promise<void> {
  const res = await fetchWithTimeout(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: process.env.TELEGRAM_CHAT_ID,
      text: html.slice(0, 4000),
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Telegram ${res.status}: ${body.slice(0, 200)}`);
  }
}
