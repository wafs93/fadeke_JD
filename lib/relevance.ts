import { containsPhrase } from "@/lib/util";

// Titles a VA with Fadeke's background could realistically apply for. The
// profile's own target titles are added to this list at fetch time.
export const DEFAULT_TITLE_PHRASES = [
  "virtual assistant",
  "executive assistant",
  "administrative assistant",
  "admin assistant",
  "administrative coordinator",
  "personal assistant",
  "office assistant",
  "operations assistant",
  "remote assistant",
  "va",
  "customer service",
  "customer support",
  "customer care",
  "customer experience associate",
  "support specialist",
  "support representative",
  "client support",
  "client success associate",
  "data entry",
  "social media assistant",
  "social media coordinator",
  "social media manager",
  "community moderator",
  "project coordinator",
  "scheduling coordinator",
  "appointment setter",
  "calendar manager",
  "inbox manager",
  "receptionist",
  "chat support",
  "email support",
];

// Words that make a title a poor fit regardless of the phrases above.
const REJECT_PHRASES = [
  "engineer",
  "developer",
  "software",
  "director",
  "vp",
  "head of",
  "nurse",
  "attorney",
  "lawyer",
  "physician",
  "accountant",
  "data scientist",
  "devops",
  "medical assistant",
  "dental assistant",
  "pharmacy",
  "teacher",
  "driver",
];

export function isRelevantTitle(title: string, extraPhrases: string[] = []): boolean {
  const t = title.toLowerCase();
  if (REJECT_PHRASES.some((p) => containsPhrase(t, p))) return false;
  const phrases = [...DEFAULT_TITLE_PHRASES, ...extraPhrases.map((p) => p.toLowerCase().trim()).filter(Boolean)];
  return phrases.some((p) => containsPhrase(t, p));
}
