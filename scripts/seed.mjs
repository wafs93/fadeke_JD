// One-time seed of the master profile from a local, gitignored JSON file.
//
//   npm run seed                      # reads ./seed.local.json
//   npm run seed -- path/to/file.json # reads another file
//   npm run seed -- --force           # replace an existing profile's experiences/education
//
// Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local,
// and the user (auth_email) must already exist in Supabase Auth.
// Contact details (email, phone) are never seeded: enter them on the Profile page.

import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const args = process.argv.slice(2);
const force = args.includes("--force");
const file = args.find((a) => !a.startsWith("--")) ?? "seed.local.json";

function fail(message) {
  console.error(`seed: ${message}`);
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) fail("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local");

let seed;
try {
  seed = JSON.parse(await readFile(file, "utf8"));
} catch (e) {
  fail(`could not read ${file}: ${e.message}. Copy seed.example.json to seed.local.json first.`);
}

if (!seed.auth_email || seed.auth_email.startsWith("REPLACE_")) {
  fail(`set "auth_email" in ${file} to the login email of the Supabase user to seed`);
}

const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

async function findUserId(email) {
  const target = email.toLowerCase();
  for (let page = 1; page < 50; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) fail(`listing users failed: ${error.message}`);
    const hit = data.users.find((u) => (u.email ?? "").toLowerCase() === target);
    if (hit) return hit.id;
    if (data.users.length < 200) break;
  }
  return null;
}

const userId = await findUserId(seed.auth_email);
if (!userId) {
  fail(`no Supabase Auth user with email ${seed.auth_email}. Create one in Authentication > Users, then re-run.`);
}

const { data: existing } = await supabase.from("profiles").select("user_id").eq("user_id", userId).maybeSingle();
if (existing && !force) {
  fail("a profile already exists for this user. Edit it on the Profile page, or re-run with --force to replace it.");
}

const p = seed.profile ?? {};
const { error: profileError } = await supabase.from("profiles").upsert({
  user_id: userId,
  full_name: p.full_name ?? "",
  location: p.location ?? null,
  timezone: p.timezone ?? "WAT, UTC+1",
  target_titles: p.target_titles ?? [],
  min_hourly_rate: p.min_hourly_rate ?? null,
  summary: p.summary ?? "",
  skills: p.skills ?? [],
  tools: p.tools ?? [],
  languages: p.languages ?? [],
  updated_at: new Date().toISOString(),
});
if (profileError) fail(`profile: ${profileError.message}`);

await supabase.from("experiences").delete().eq("user_id", userId);
await supabase.from("education").delete().eq("user_id", userId);

const experiences = (seed.experiences ?? []).map((e, i) => ({
  user_id: userId,
  employer: e.employer,
  title: e.title,
  start_date: e.start_date ?? null,
  end_date: e.end_date ?? null,
  current: Boolean(e.current),
  location: e.location ?? null,
  remote: Boolean(e.remote),
  // Unconfirmed roles never carry bullets, whatever the file says.
  bullets: e.verified ? (e.bullets ?? []) : [],
  verified: Boolean(e.verified),
  sort_order: i,
}));
if (experiences.length) {
  const { error } = await supabase.from("experiences").insert(experiences);
  if (error) fail(`experiences: ${error.message}`);
}

const education = (seed.education ?? []).map((e) => ({ user_id: userId, ...e }));
if (education.length) {
  const { error } = await supabase.from("education").insert(education);
  if (error) fail(`education: ${error.message}`);
}

const unverified = experiences.filter((e) => !e.verified).map((e) => e.employer);
console.log(`seed: profile saved with ${experiences.length} experiences and ${education.length} education entries.`);
if (unverified.length) console.log(`seed: needs confirmation on the Profile page: ${unverified.join(", ")}`);
