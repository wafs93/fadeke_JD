import type { ProfileBundle } from "@/lib/profile";
import { profileFactsText } from "@/lib/facts";
import { findPlaceholders } from "@/lib/util";

export interface KitTexts {
  cv_text: string;
  cover_letter: string;
  answers_text: string;
}

export interface KitCheck {
  placeholders: { doc: string; items: string[] }[];
  unknownNumbers: string[];
  unconfirmedMentions: string[];
}

const DOC_LABELS: Record<keyof KitTexts, string> = {
  cv_text: "CV",
  cover_letter: "Cover letter",
  answers_text: "Answers",
};

function numbersIn(text: string): string[] {
  return (text.match(/\d[\d,.]*/g) ?? []).map((n) => n.replace(/[,.]+$/, "").replace(/,/g, "")).filter(Boolean);
}

/**
 * Guards for "never invent facts": lists [placeholders] still to fill, any
 * number that appears in neither the profile nor the job post, and any
 * mention of an unconfirmed employer. Runs on the saved text, so it stays
 * accurate after Fadeke edits.
 */
export function checkKit(texts: KitTexts, bundle: ProfileBundle, jobText: string): KitCheck {
  const placeholders = (Object.keys(DOC_LABELS) as (keyof KitTexts)[])
    .map((key) => ({ doc: DOC_LABELS[key], items: findPlaceholders(texts[key]) }))
    .filter((p) => p.items.length > 0);

  const p = bundle.profile;
  const allowedSource = [profileFactsText(bundle), jobText, p?.phone ?? "", p?.email ?? "", String(p?.min_hourly_rate ?? "")].join("\n");
  const allowed = new Set(numbersIn(allowedSource));
  const all = `${texts.cv_text}\n${texts.cover_letter}\n${texts.answers_text}`;
  const unknownNumbers = Array.from(new Set(numbersIn(all.replace(/\[[^\]]*\]/g, "")))).filter((n) => !allowed.has(n));

  const lower = `${texts.cover_letter}\n${texts.answers_text}\n${texts.cv_text}`.toLowerCase();
  const unconfirmedMentions = bundle.experiences
    .filter((e) => !e.verified && e.employer.trim().length > 2 && lower.includes(e.employer.toLowerCase()))
    .map((e) => e.employer);

  return { placeholders, unknownNumbers, unconfirmedMentions };
}
