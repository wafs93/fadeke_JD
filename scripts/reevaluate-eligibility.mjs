// One-off: re-check every job in the database against the current Nigeria
// eligibility rules, then ask the small model about the ones still unclear.
//
//   npm run reevaluate              # rules + AI, writes results
//   npm run reevaluate -- --no-ai   # rules only
//   npm run reevaluate -- --dry-run # print counts, write nothing
//
// Uses SUPABASE_SERVICE_ROLE_KEY and OPENAI_API_KEY from .env.local.
// Works before migration 002 (writes ng_eligible and ng_reason only; the
// reason keeps the quoted evidence), and fully after it.

import { createRequire } from "node:module";

const require = createRequire(`${process.cwd()}/package.json`);
const { createClient } = require("@supabase/supabase-js");

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const useAi = !args.includes("--no-ai");

// The lib files are TypeScript loaded by tsx as CommonJS.
async function load(file) {
  const mod = await import(`../lib/${file}.ts`);
  return { ...mod.default, ...mod };
}

const { checkNigeriaEligibility, statusToEligible, eligibleToStatus } = await load("eligibility");
const { classifyUnclearJob, hasNgColumns } = await load("ng-ai");
const { mapWithConcurrency } = await load("util");

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const hasCols = await hasNgColumns(admin);
if (!hasCols) console.log("! Migration 002 not run yet: saving ng_eligible and ng_reason only (evidence stays in the reason).");

const jobs = [];
for (let from = 0; ; from += 500) {
  const { data, error } = await admin
    .from("jobs")
    .select("id, source, title, company, region_text, description, ng_eligible")
    .order("fetched_at", { ascending: false })
    .range(from, from + 499);
  if (error) throw new Error(error.message);
  jobs.push(...data);
  if (data.length < 500) break;
}
console.log(`Re-checking ${jobs.length} jobs${dryRun ? " (dry run)" : ""}…`);

const HIMALAYAS_DEFAULT = "Worldwide (no location restrictions listed on Himalayas)";
const results = new Map();
let aiCalls = 0;

for (const job of jobs) {
  // Older Himalayas rows stored a bare "Worldwide" for "no restrictions listed".
  if (job.source === "himalayas" && job.region_text === "Worldwide") job.region_text = HIMALAYAS_DEFAULT;
  results.set(job.id, { ...checkNigeriaEligibility(job.region_text, job.description, job.title), method: "rules" });
}

if (useAi) {
  const unclear = jobs.filter((j) => results.get(j.id).status === "unclear");
  console.log(`Asking the small model about ${unclear.length} unclear jobs…`);
  await mapWithConcurrency(unclear, 4, async (job) => {
    try {
      aiCalls++;
      results.set(job.id, { ...(await classifyUnclearJob(job)), method: "ai" });
    } catch (e) {
      console.log(`  ✕ ${job.title}: ${e instanceof Error ? e.message : e}`);
    }
  });
}

const counts = { open: 0, unclear: 0, closed: 0 };
const moves = {};
for (const job of jobs) {
  const r = results.get(job.id);
  counts[r.status]++;
  const key = `${eligibleToStatus(job.ng_eligible)} → ${r.status}`;
  moves[key] = (moves[key] ?? 0) + 1;
}

if (!dryRun) {
  const now = new Date().toISOString();
  const failures = [];
  await mapWithConcurrency(jobs, 8, async (job) => {
    const r = results.get(job.id);
    const row = { ng_eligible: statusToEligible(r.status), ng_reason: r.reason, region_text: job.region_text };
    if (hasCols) Object.assign(row, { ng_evidence: r.evidence, ng_method: r.method, ng_checked_at: now });
    const { error } = await admin.from("jobs").update(row).eq("id", job.id);
    if (error) failures.push(`${job.title}: ${error.message}`);
  });
  if (failures.length) console.log(`✕ ${failures.length} updates failed, e.g. ${failures[0]}`);
}

console.log(`\nResult: open ${counts.open} · unclear ${counts.unclear} · closed ${counts.closed}  (AI calls: ${aiCalls})`);
console.log("Changes from before:", moves);
console.log("\nSample open jobs:");
for (const job of jobs.filter((j) => results.get(j.id).status === "open").slice(0, 5)) {
  const r = results.get(job.id);
  console.log(`  • ${job.title} | ${job.source} | ${r.method === "ai" ? "AI" : "rules"}: "${r.evidence}"`);
}
