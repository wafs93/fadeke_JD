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
  /** Sentences that claim things the profile does not record. */
  unsupportedClaims: string[];
}

// Claims the profile cannot back up (it has no fields for them), so any such
// sentence was written by the model, not taken from her facts.
const CLAIM_PATTERNS: { label: string; re: RegExp }[] = [
  { label: "availability or hours", re: /\b(available to (?:work|start)|available (?:full|part)[- ]time|(?:full|part)[- ]time availability|can start (?:immediately|right away|on)|available immediately)\b/i },
  { label: "travel or relocation", re: /\b(open to (?:any )?(?:travel|relocat\w*)|willing to (?:travel|relocate)|able to travel|happy to relocate)\b/i },
  { label: "office attendance", re: /\b(your|the) [A-Z][\w ]{1,30} office\b|\b(?:work|working) (?:from|in) (?:your|the) office\b/ },
  { label: "years of experience", re: /\b(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)\+? years? of (?:\w+ )?experience\b/i },
  { label: "learning promises", re: /\b(quickly (?:learn|adapt|pick up)|fast learner|eager to learn)\b/i },
  { label: "soft-skill claims", re: /\b(strong|excellent|exceptional|proven) (problem[- ]solving|communication|technical|interpersonal|analytical) skills\b/i },
  { label: "inflated wording", re: /\b(extensive (?:experience|knowledge)|proven (?:track record|ability)|adept at|expert (?:in|at)|my expertise)\b/i },
  {
    label: "result to verify",
    re: /\b(saved|saving|reduced|cut|increased|improved|grew|boosted)\b[^.\n]{0,60}\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|twenty|thirty|fifty|half|dozens?|hundreds?)\b[^.\n]{0,20}\b(hours?|minutes?|days?|weeks?|percent|%|times|clients?|followers?)\b/i,
  },
  { label: "pay agreement", re: /\b(comfortable with (?:this|the) (?:pay|rate|salary)|(?:happy|fine|okay|ok) with (?:this|the) (?:pay|rate|salary)|accept (?:this|the) (?:pay|rate|salary)|my (?:pay|rate) expectations are flexible)\b/i },
];

// Questions that ask for a real past event. Unless her profile records one,
// the model had nothing true to write, so the answer must be checked.
const STORY_QUESTION = /\b(describe (?:a|one|the) (?:\w+ )?(?:time|situation|trip|task|project|occasion|moment)|give (?:us )?an example|tell (?:us|me) about a time|share an example|walk (?:us|me) through a time|have you (?:ever )?\w+[^?]{0,80}\? give an example)\b/i;

function storyAnswersToVerify(answersText: string): string[] {
  const out: string[] = [];
  for (const block of answersText.split(/\n\s*\n/)) {
    const q = block.match(/^Q:\s*(.+)$/m)?.[1] ?? "";
    const a = block.match(/^A:\s*([\s\S]+)$/m)?.[1] ?? "";
    if (STORY_QUESTION.test(q) && a && !/\[[^\]]+\]/.test(a)) out.push(`story to verify: "${q.slice(0, 120)}"`);
  }
  return out;
}

function sentencesWith(text: string, re: RegExp): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .filter((s) => re.test(s))
    .map((s) => s.trim());
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

  const profileText = allowedSource.toLowerCase();
  const unsupportedClaims: string[] = [];
  for (const { label, re } of CLAIM_PATTERNS) {
    for (const sentence of sentencesWith(all.replace(/\[[^\]]*\]/g, ""), re)) {
      const phrase = sentence.match(re)?.[0]?.toLowerCase() ?? "";
      if (phrase && profileText.includes(phrase)) continue; // she said it herself
      unsupportedClaims.push(`${label}: "${sentence.slice(0, 160)}"`);
    }
  }

  unsupportedClaims.push(...storyAnswersToVerify(texts.answers_text));

  return { placeholders, unknownNumbers, unconfirmedMentions, unsupportedClaims: Array.from(new Set(unsupportedClaims)) };
}
