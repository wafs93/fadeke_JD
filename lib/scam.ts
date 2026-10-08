import type { ScamFlag, ScamLevel } from "@/lib/types";

interface Rule {
  id: string;
  label: string;
  weight: number;
  pattern: RegExp;
}

// Common remote-VA scam signals. Each match adds its weight; the total is
// capped at 100. Patterns are deliberately specific to avoid flagging normal
// posts (e.g. "fee" alone is not flagged, "training fee" is).
const RULES: Rule[] = [
  {
    id: "pay_to_apply",
    label: "Asks you to pay (fee, training, starter kit or equipment)",
    weight: 45,
    pattern:
      /\b(registration|application|training|onboarding|processing|activation|membership|starter[- ]kit|certification) (fee|cost|payment)s?\b|\bpay (?:a |the )?(?:small |one[- ]time |refundable )?fee\b|\b(buy|purchase) (?:your own |the )?(?:equipment|software|laptop|starter kit) (?:from|through) (?:our|a|the) (?:vendor|supplier)\b/i,
  },
  {
    id: "cheque_equipment",
    label: "Sends a cheque or money for you to buy equipment",
    weight: 45,
    pattern: /\b(send|mail|deposit)(?:ing)? (?:you )?(?:a )?(cheque|check)\b|\bcheck to (?:buy|purchase)\b|\bdeposit (?:the )?(?:funds|money) (?:into|in) your\b/i,
  },
  {
    id: "money_handling",
    label: "Involves moving money, gift cards or crypto for them",
    weight: 40,
    pattern:
      /\b(gift ?cards?|bitcoin|crypto(?:currency)?|usdt|western union|moneygram)\b|\b(receive|transfer|forward) (?:payments|funds|money) (?:on behalf|for (?:the|our) (?:company|clients?))\b|\bpayment processing agent\b/i,
  },
  {
    id: "sensitive_info",
    label: "Asks for bank details, BVN, NIN, ID or passwords up front",
    weight: 35,
    pattern:
      /\b(bvn|nin|social security|ssn)\b|\b(send|provide|share|submit) (?:us )?(?:your )?(bank (?:account )?details|account number|card details|id card|passport|password|login)\b/i,
  },
  {
    id: "chat_only",
    label: "Interview or contact only by Telegram, WhatsApp, Signal or Hangouts",
    weight: 25,
    pattern:
      /\b(telegram|whatsapp|signal app|google hangouts|wickr|kik)\b[^.\n]{0,40}\b(interview|contact|message|text|reach|apply)\b|\b(interview|contact|message|text|reach|apply)\b[^.\n]{0,40}\b(telegram|whatsapp|google hangouts|wickr)\b/i,
  },
  {
    id: "no_interview",
    label: "Promises a job with no interview",
    weight: 20,
    pattern: /\bno interview\b|\bhired (?:immediately|instantly|on the spot)\b|\bguaranteed (?:job|hire|employment)\b/i,
  },
  {
    id: "unrealistic_pay",
    label: "Pay that sounds too good for the work",
    weight: 20,
    pattern:
      /\bearn (?:up to )?\$?\s?\d{1,3}(?:,\d{3})+ (?:per|a|each) (?:week|day)\b|\$\s?\d{3,}(?:\.\d+)?\s?(?:\/|per|an?) ?(?:hour|hr)\b|\b(?:no experience (?:needed|required)[^.\n]{0,60}\$\s?\d{2,}\s?(?:\/|per) ?(?:hour|hr))|\bearn \$?\d{3,} (?:daily|per day)\b/i,
  },
  {
    id: "personal_email",
    label: "Apply through a personal email (Gmail, Yahoo, Outlook)",
    weight: 15,
    pattern: /\b[a-z0-9._%+-]+@(gmail|yahoo|ymail|outlook|hotmail|aol|proton(?:mail)?)\.[a-z.]+\b/i,
  },
  {
    id: "urgency",
    label: "Pressure to act fast (limited slots, urgent, today only)",
    weight: 10,
    pattern: /\b(limited (?:slots|spots|positions)|only \d+ (?:slots|spots) left|apply (?:now|today) before|urgent(?:ly)? hiring|act fast|today only|hiring immediately)\b/i,
  },
  {
    id: "upfront_mlm",
    label: "Recruiting others or commission-only wording",
    weight: 15,
    pattern: /\b(commission[- ]only|recruit (?:your )?friends|build your (?:own )?team|downline|mlm|be your own boss)\b/i,
  },
  {
    id: "reshipping",
    label: "Package receiving or reshipping",
    weight: 35,
    pattern: /\b(reship(?:ping)?|receive (?:and|&) (?:re)?ship|package (?:handler|forwarding|inspector))\b/i,
  },
];

export interface ScamResult {
  score: number;
  level: ScamLevel;
  flags: ScamFlag[];
}

function evidence(text: string, index: number, length: number): string {
  const start = Math.max(0, index - 40);
  const end = Math.min(text.length, index + length + 40);
  return `${start > 0 ? "…" : ""}${text.slice(start, end).replace(/\s+/g, " ").trim()}${end < text.length ? "…" : ""}`;
}

export function scamLevel(score: number): ScamLevel {
  if (score >= 50) return "high";
  if (score >= 20) return "medium";
  return "low";
}

/** Rule-based scam check, shared by the fetcher and the Scam check page. */
export function assessScam(input: { title: string; company: string; description: string; salary_text?: string | null }): ScamResult {
  const text = `${input.title}\n${input.salary_text ?? ""}\n${input.description}`;
  const flags: ScamFlag[] = [];

  for (const rule of RULES) {
    const m = rule.pattern.exec(text);
    if (m) {
      flags.push({ id: rule.id, label: rule.label, weight: rule.weight, evidence: evidence(text, m.index, m[0].length) });
    }
  }

  if (!input.company.trim()) {
    flags.push({ id: "no_company", label: "No company name given", weight: 10 });
  }

  const wordCount = input.description.trim().split(/\s+/).filter(Boolean).length;
  if (wordCount > 0 && wordCount < 60) {
    flags.push({ id: "thin_post", label: "Very short post with few details", weight: 5 });
  }

  const score = Math.min(100, flags.reduce((sum, f) => sum + f.weight, 0));
  return { score, level: scamLevel(score), flags };
}
