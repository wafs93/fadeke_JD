import { createHash } from "node:crypto";
import type { PasteInput } from "@/lib/paste-input";
import { enrichJob } from "@/lib/fetch-jobs";
import { statusToEligible, type Eligibility } from "@/lib/eligibility";
import type { RawJob, ScamFlag, ScamLevel } from "@/lib/types";

/**
 * "Add a job": a post Fadeke found herself (LinkedIn, X, WhatsApp...) and
 * pasted in. The link is stored for her to open; it is never fetched.
 */

/** Lowercased, Unicode-normalised, whitespace-collapsed text, so the same
 * post pasted twice (with different spacing or line breaks) matches. */
export function normalisePost(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[​-‍﻿]/g, "")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function contentHash(text: string): string {
  return createHash("sha256").update(normalisePost(text)).digest("hex");
}

/** First meaningful line of the post, as a title. */
export function titleFromPost(text: string): string {
  const line =
    text
      .split("\n")
      .map((l) => l.replace(/^[\s#*•\-–—>]+/, "").replace(/[*_]+/g, "").trim())
      .find((l) => l.length >= 3) ?? "Job post";
  return line.length > 120 ? `${line.slice(0, 117).trimEnd()}…` : line;
}

export function buildPastedJob(input: PasteInput, userId: string): RawJob & { content_hash: string } {
  const hash = contentHash(input.text);
  return {
    source: input.source,
    external_id: `${userId}:${hash}`,
    title: titleFromPost(input.text),
    company: input.company,
    url: input.link,
    description: input.text.trim(),
    region_text: "",
    posted_at: null,
    salary_text: null,
    content_hash: hash,
  };
}

export interface PasteResult {
  jobId: string;
  duplicate: boolean;
  title: string;
  eligible: boolean | null;
  ngReason: string;
  ngEvidence: string | null;
  ngMethod: "rules" | "ai";
  scamLevel: ScamLevel;
  scamScore: number;
  scamFlags: ScamFlag[];
  score: number | null;
  reasons: string[];
  have: string[];
  gaps: string[];
  /** Why there is no score, in plain words. */
  scoreNote: string | null;
}

type EnrichedRow = ReturnType<typeof enrichJob> & { content_hash: string; owner_id: string };

/** Everything the flow touches outside pure code, injected so it can be tested. */
export interface PasteDeps {
  findExisting(userId: string, hash: string): Promise<PasteResult | null>;
  classifyUnclear(job: { title: string; company: string; region_text: string; description: string }): Promise<Eligibility>;
  insertJob(row: EnrichedRow & { ng_method: "rules" | "ai" }): Promise<string>;
  /** Null when there is no profile to score against yet. */
  score(job: { id: string; title: string; company: string; region_text: string; description: string; salary_text: string | null }): Promise<{
    score: number;
    reasons: string[];
    have: string[];
    gaps: string[];
  } | null>;
  aiAvailable: boolean;
}

export async function runPasteFlow(input: PasteInput, userId: string, deps: PasteDeps): Promise<PasteResult> {
  const raw = buildPastedJob(input, userId);

  const existing = await deps.findExisting(userId, raw.content_hash);
  if (existing) return { ...existing, duplicate: true };

  // Same rules and scam check as every fetched job.
  const enriched: EnrichedRow = { ...enrichJob(raw), content_hash: raw.content_hash, owner_id: userId };
  let method: "rules" | "ai" = "rules";

  // The small model only reads posts the rules can't settle, and its answer
  // only counts with a real quote from the post (see lib/ng-ai.ts).
  if (enriched.ng_eligible === null && deps.aiAvailable) {
    try {
      const ai = await deps.classifyUnclear(enriched);
      enriched.ng_eligible = statusToEligible(ai.status);
      enriched.ng_reason = ai.reason;
      enriched.ng_evidence = ai.evidence;
      method = "ai";
    } catch {
      // Keep it unclear; it can be checked again later.
    }
  }

  const jobId = await deps.insertJob({ ...enriched, ng_method: method });

  const base: PasteResult = {
    jobId,
    duplicate: false,
    title: enriched.title,
    eligible: enriched.ng_eligible,
    ngReason: enriched.ng_reason,
    ngEvidence: enriched.ng_evidence,
    ngMethod: method,
    scamLevel: enriched.scam_level,
    scamScore: enriched.scam_score,
    scamFlags: enriched.scam_flags,
    score: null,
    reasons: [],
    have: [],
    gaps: [],
    scoreNote: null,
  };

  // Only score jobs she can apply for, and never high scam risk ones.
  if (enriched.ng_eligible !== true) {
    return { ...base, scoreNote: enriched.ng_eligible === false ? "Not scored: you can't apply from Nigeria." : "Not scored until the location is clear." };
  }
  if (enriched.scam_level === "high") return { ...base, scoreNote: "Not scored: this post shows strong scam signs." };

  try {
    const m = await deps.score({ ...enriched, id: jobId });
    if (!m) return { ...base, scoreNote: "Not scored yet: fill in your Profile first." };
    return { ...base, score: m.score, reasons: m.reasons, have: m.have, gaps: m.gaps };
  } catch (e) {
    return { ...base, scoreNote: `Couldn't score it just now (${e instanceof Error ? e.message : String(e)}). Try "Score new jobs" later.` };
  }
}
