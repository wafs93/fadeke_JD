import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPastedJob, contentHash, normalisePost, runPasteFlow, titleFromPost, type PasteDeps, type PasteResult } from "@/lib/paste";
import { pasteInputSchema } from "@/lib/paste-input";
import type { Eligibility } from "@/lib/eligibility";

const OPEN_POST = `Virtual Assistant (Remote)
We're a small design studio hiring a virtual assistant to manage our inbox, calendar and client follow-ups.
This role is fully remote and open to candidates worldwide. 20 hours a week. Apply with your CV through our careers page.`;

const US_POST = `Executive Assistant
Support our CEO with scheduling and travel. Must be authorized to work in the United States.
Full-time, remote within the US. Apply on our website with your CV and a short note.`;

const SCAM_POST = `Virtual Assistant needed urgently
Earn $5,000 per week from home, no interview! Message us on Telegram to apply.
You will pay a small fee for the starter kit and send your BVN to get started. Open to applicants worldwide.`;

const UNCLEAR_POST = `Admin Assistant
We need an organised admin assistant to keep our CRM tidy, book meetings and answer client emails.
Part-time, flexible hours. Send your CV and tell us about a time you organised a busy calendar.`;

function input(text: string, extra: Partial<{ link: string; company: string; source: string }> = {}) {
  return pasteInputSchema.parse({ text, link: "", company: "", source: "linkedin", ...extra });
}

/** In-memory stand-ins for Supabase and the models. */
function fakeDeps(opts: { ai?: Eligibility; profile?: boolean; aiAvailable?: boolean } = {}) {
  const rows: Record<string, unknown>[] = [];
  const calls = { classify: 0, score: 0 };
  const deps: PasteDeps = {
    aiAvailable: opts.aiAvailable ?? true,
    async findExisting(userId, hash) {
      const row = rows.find((r) => r.owner_id === userId && r.content_hash === hash);
      if (!row) return null;
      return { jobId: row.id, duplicate: true, title: row.title, eligible: row.ng_eligible } as unknown as PasteResult;
    },
    async classifyUnclear() {
      calls.classify++;
      return opts.ai ?? { status: "unclear", eligible: null, reason: "AI could not find a clear location statement", evidence: null };
    },
    async insertJob(row) {
      const id = `job-${rows.length + 1}`;
      rows.push({ ...row, id });
      return id;
    },
    async score() {
      calls.score++;
      return opts.profile === false ? null : { score: 81, reasons: ["Inbox and calendar match"], have: ["Calendar"], gaps: [] };
    },
  };
  return { deps, rows, calls };
}

test("normalised hash ignores case, spacing and line breaks", () => {
  assert.equal(contentHash("Virtual  Assistant\n\nRemote"), contentHash("virtual assistant remote"));
  assert.equal(contentHash("“Quoted” — post"), contentHash('"quoted" — post'));
  assert.notEqual(contentHash("Virtual Assistant"), contentHash("Virtual Assistants"));
  assert.equal(normalisePost("  A​ B \t C "), "a b c");
});

test("title comes from the first meaningful line", () => {
  assert.equal(titleFromPost("\n\n**Hiring:** Virtual Assistant\nmore"), "Hiring: Virtual Assistant");
  assert.equal(titleFromPost("• Social Media Coordinator"), "Social Media Coordinator");
  assert.ok(titleFromPost("x".repeat(300)).length <= 120);
});

test("input validation", () => {
  assert.equal(pasteInputSchema.safeParse({ text: "too short", source: "linkedin" }).success, false);
  assert.equal(pasteInputSchema.safeParse({ text: OPEN_POST, source: "myspace" }).success, false);
  assert.equal(pasteInputSchema.safeParse({ text: OPEN_POST, source: "x", link: "javascript:alert(1)" }).success, false);
  assert.equal(pasteInputSchema.safeParse({ text: OPEN_POST, source: "whatsapp", link: "https://example.com/job" }).success, true);
});

test("pasted job row: source, private id, link kept but never needed", () => {
  const row = buildPastedJob(input(OPEN_POST, { link: "https://www.linkedin.com/jobs/view/1", company: "Studio" }), "user-1");
  assert.equal(row.source, "linkedin");
  assert.equal(row.company, "Studio");
  assert.equal(row.url, "https://www.linkedin.com/jobs/view/1");
  assert.equal(row.external_id, `user-1:${row.content_hash}`);
  assert.equal(row.title, "Virtual Assistant (Remote)");
  assert.equal(buildPastedJob(input(OPEN_POST), "user-1").url, "");
});

test("open post: rules decide, no AI call, scored", async () => {
  const { deps, rows, calls } = fakeDeps();
  const r = await runPasteFlow(input(OPEN_POST), "user-1", deps);
  assert.equal(r.eligible, true);
  assert.match(r.ngEvidence ?? "", /worldwide/i);
  assert.equal(r.scamLevel, "low");
  assert.equal(r.score, 81);
  assert.equal(calls.classify, 0);
  assert.equal(rows[0].owner_id, "user-1");
  assert.equal(rows[0].ng_method, "rules");
});

test("closed post: not scored, says why", async () => {
  const { deps, calls } = fakeDeps();
  const r = await runPasteFlow(input(US_POST), "user-1", deps);
  assert.equal(r.eligible, false);
  assert.match(r.ngReason, /work in/i);
  assert.equal(r.score, null);
  assert.match(r.scoreNote ?? "", /can't apply from Nigeria/);
  assert.equal(calls.score, 0);
});

test("scam post: flagged high, not scored", async () => {
  const { deps, calls } = fakeDeps();
  const r = await runPasteFlow(input(SCAM_POST), "user-1", deps);
  assert.equal(r.scamLevel, "high");
  assert.ok(r.scamFlags.some((f) => f.id === "pay_to_apply"));
  assert.equal(r.score, null);
  assert.equal(calls.score, 0);
});

test("unclear post: small model only then, and only a quoted 'open' counts", async () => {
  const stays = fakeDeps();
  const r1 = await runPasteFlow(input(UNCLEAR_POST), "user-1", stays.deps);
  assert.equal(stays.calls.classify, 1);
  assert.equal(r1.eligible, null);
  assert.equal(stays.calls.score, 0);

  const opens = fakeDeps({ ai: { status: "open", eligible: true, reason: 'AI found in the post: "x"', evidence: "x" } });
  const r2 = await runPasteFlow(input(UNCLEAR_POST), "user-1", opens.deps);
  assert.equal(r2.eligible, true);
  assert.equal(r2.ngMethod, "ai");
  assert.equal(opens.rows[0].ng_method, "ai");

  const noAi = fakeDeps({ aiAvailable: false });
  await runPasteFlow(input(UNCLEAR_POST), "user-1", noAi.deps);
  assert.equal(noAi.calls.classify, 0);
});

test("same post twice is not saved twice, even with different spacing", async () => {
  const { deps, rows } = fakeDeps();
  await runPasteFlow(input(OPEN_POST), "user-1", deps);
  const again = await runPasteFlow(input(OPEN_POST.replace(/\n/g, "\n\n  ").toUpperCase()), "user-1", deps);
  assert.equal(again.duplicate, true);
  assert.equal(rows.length, 1);
  // Another user pasting the same post gets their own private copy.
  await runPasteFlow(input(OPEN_POST), "user-2", deps);
  assert.equal(rows.length, 2);
});

test("no profile yet: saved, but not scored", async () => {
  const { deps } = fakeDeps({ profile: false });
  const r = await runPasteFlow(input(OPEN_POST), "user-1", deps);
  assert.equal(r.score, null);
  assert.match(r.scoreNote ?? "", /Profile/);
});
