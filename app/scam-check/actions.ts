"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { chatJson } from "@/lib/openai";

const opinionSchema = z.object({
  verdict: z.enum(["looks genuine", "be careful", "likely scam"]),
  reasons: z.array(z.string()).max(6),
  next_steps: z.array(z.string()).max(5),
});

export type SecondOpinion = z.infer<typeof opinionSchema>;

const SYSTEM_PROMPT = `You help a remote job seeker in Lagos, Nigeria, judge whether a pasted job post is a scam.
Look for: fees or paying for training/equipment, cheques to buy equipment, moving money/gift cards/crypto, requests for bank details, BVN, NIN or ID before an offer, chat-only interviews (Telegram/WhatsApp), no interview, pay far above market for simple work, personal email addresses, pressure tactics, vague company details, reshipping.
Also note genuine signs (named company with a website, clear duties, normal hiring process).
Be fair: do not call a post a scam without evidence from the text.
Reply with JSON only: {"verdict":"looks genuine"|"be careful"|"likely scam","reasons":["short reason quoting the post where possible"],"next_steps":["practical check she can do, e.g. look up the company website and apply there"]}`;

export async function getSecondOpinion(post: string): Promise<{ ok: true; data: SecondOpinion } | { ok: false; error: string }> {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Not signed in" };
    const text = post.trim();
    if (text.length < 40) return { ok: false, error: "Paste the whole post first." };
    const data = await chatJson(SYSTEM_PROMPT, `JOB POST:\n${text.slice(0, 8000)}`, (raw) => opinionSchema.safeParse(raw), 0.2);
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
