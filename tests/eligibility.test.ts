import { test } from "node:test";
import assert from "node:assert/strict";
import { checkNigeriaEligibility, quoteSupportsOpen, type NgStatus } from "@/lib/eligibility";

// [description of case, region field, description text, title, expected]
const CASES: [string, string, string, string, NgStatus][] = [
  // --- the ten required phrases ---
  ["Remote (US only)", "Remote (US only)", "", "", "closed"],
  ["Anywhere in the world", "Anywhere in the World", "", "", "open"],
  ["authorized to work in the US", "Worldwide", "Must be authorized to work in the US.", "", "closed"],
  ["EMEA", "EMEA", "", "", "unclear"],
  ["Remote, EST hours", "", "Remote, EST hours", "", "closed"],
  ["Africa-based", "", "We are hiring Africa-based virtual assistants.", "", "open"],
  ["Work from anywhere", "", "Work from anywhere with a laptop and good internet.", "", "open"],
  ["Hybrid in London", "", "This role is hybrid in London, 2 days a week.", "", "closed"],
  ["Europe timezone required", "", "Remote. Europe timezone required.", "", "unclear"],
  ["Open to candidates in Nigeria", "", "Open to candidates in Nigeria, Ghana and Kenya.", "", "open"],
  // --- more real-world wording ---
  ["Worldwide region", "Worldwide", "", "", "open"],
  ["Lagos named", "", "Our team is based in Lagos and we hire remotely.", "", "open"],
  ["global remote", "", "This is a fully remote, global role.", "", "open"],
  ["all countries", "", "We accept applications from all countries.", "", "open"],
  ["must reside in US", "Anywhere", "Candidates must reside in the United States.", "", "closed"],
  ["must be located in Europe", "", "You must be located in Europe.", "", "closed"],
  ["visa sponsorship", "Worldwide", "Visa sponsorship is not available for this role.", "", "closed"],
  ["work permit", "", "A valid work permit is required.", "", "closed"],
  ["citizens only", "", "US citizens only.", "", "closed"],
  ["PST hours", "Remote", "You will work 9am-5pm PST.", "", "closed"],
  ["Time Zone : PT or ET", "Worldwide", "Monthly Rate : $450-800 Time Zone : PT or ET", "", "closed"],
  ["ET/PT", "Anywhere", "Shifts cover ET/PT clients.", "", "closed"],
  ["GMT overlap is fine", "Worldwide", "You must be available for some overlap with GMT 10:00-14:00.", "", "open"],
  ["US time zones", "", "Must be available during US business hours.", "", "closed"],
  ["on-site", "", "This is an on-site position in Manila.", "", "closed"],
  ["onsite in city", "", "Onsite in Lagos? No: onsite in Toronto, Monday to Friday.", "", "closed"],
  ["benefits for US staff are not a limit", "Worldwide", "Health insurance for eligible US-based team members.", "", "open"],
  ["in-person colleague is not a limit", "Worldwide", "The doctor works with one in-person medical assistant.", "", "open"],
  ["team offsites are not a limit", "Anywhere", "Teams meet two to four times yearly in person. Co-ordinate onsite/offsite meetings.", "", "open"],
  ["Philippines region", "Philippines", "", "", "closed"],
  ["city list", "New York, NY; Austin, TX", "", "", "closed"],
  ["title tag (US)", "", "", "Virtual Assistant (US)", "closed"],
  ["title tag (UK)", "Worldwide", "", "Customer Support Agent (UK)", "closed"],
  ["title tag UAE or Europe", "Anywhere in the World", "", "Executive Assistant (Remote, UAE or Europe)", "closed"],
  ["anywhere in the US", "", "Work from anywhere in the US!", "", "closed"],
  ["except Nigeria", "Worldwide", "We hire everywhere except Nigeria.", "", "closed"],
  ["South Africa only", "South Africa", "", "", "closed"],
  ["remote, nothing else", "Remote", "Join our friendly team. Contact us with questions.", "", "unclear"],
  ["no location at all", "", "Great VA role managing inboxes.", "", "unclear"],
  ["open to LATAM", "", "We are open to candidates in Latin America.", "", "closed"],
  ["not hybrid is fine", "Worldwide", "This is not hybrid: fully remote, worldwide.", "", "open"],
  ["lowercase us is not a country", "Worldwide", "Give us hours of your week and overlap with us on Slack.", "", "open"],
  ["Himalayas no restrictions", "Worldwide (no location restrictions listed on Himalayas)", "", "", "open"],
];

for (const [name, region, desc, title, expected] of CASES) {
  test(`eligibility: ${name} -> ${expected}`, () => {
    const r = checkNigeriaEligibility(region, desc, title);
    assert.equal(r.status, expected, `${r.status}: ${r.reason}`);
    if (expected === "open") assert.ok(r.evidence && r.evidence.length > 0, "open needs evidence");
    if (expected !== "unclear") assert.equal(r.eligible, expected === "open");
    else assert.equal(r.eligible, null);
  });
}

test("model quotes must really support 'open'", () => {
  assert.ok(quoteSupportsOpen("We hire from anywhere in the world"));
  assert.ok(quoteSupportsOpen("Open to applicants in Africa"));
  assert.ok(!quoteSupportsOpen("This is a fully remote role"));
  assert.ok(!quoteSupportsOpen("Remote within the US"));
});

test("AI verdicts need a real, supporting quote", async () => {
  const { validateAiVerdict } = await import("@/lib/ng-ai");
  const post = "Title: VA\nWe are a remote team. We hire from anywhere in the world. Apply today.";
  assert.equal(validateAiVerdict(post, { status: "open", quote: "We hire from anywhere in the world", reason: "" }).status, "open");
  // quote not in the post
  assert.equal(validateAiVerdict(post, { status: "open", quote: "Open to Nigeria", reason: "" }).status, "unclear");
  // no quote
  assert.equal(validateAiVerdict(post, { status: "open", quote: "", reason: "" }).status, "unclear");
  // quote is in the post but does not support open
  assert.equal(validateAiVerdict(post, { status: "open", quote: "We are a remote team", reason: "" }).status, "unclear");
  // closed also needs a real quote
  assert.equal(validateAiVerdict(post, { status: "closed", quote: "US only", reason: "" }).status, "unclear");
  assert.equal(
    validateAiVerdict("Must live in Canada. Remote.", { status: "closed", quote: "Must live in Canada", reason: "" }).status,
    "closed"
  );
});

test("Himalayas time-zone ranges", () => {
  assert.equal(checkNigeriaEligibility("Worldwide (no location restrictions listed on Himalayas) · Time zones UTC-8 to UTC-5 only", "").status, "closed");
  assert.equal(checkNigeriaEligibility("Nigeria · Time zones UTC+1 to UTC+1 only", "").status, "open");
  assert.equal(checkNigeriaEligibility("Worldwide (no location restrictions listed on Himalayas) · Time zones UTC-1 to UTC+6 only", "").status, "open");
});

test("Himalayas mapping keeps restrictions and time zones", async () => {
  const { mapHimalayasJobs } = await import("@/lib/sources/himalayas");
  const [a, b] = mapHimalayasJobs({
    jobs: [
      { title: "Virtual Executive Administrative Assistant", guid: "https://himalayas.app/a", locationRestrictions: ["Nigeria"], timezoneRestrictions: [1], pubDate: 1760000000 },
      { title: "Virtual Assistant", guid: "https://himalayas.app/b", locationRestrictions: [], timezoneRestrictions: Array.from({ length: 30 }, (_, i) => i - 11) },
    ],
  });
  assert.equal(a.region_text, "Nigeria · Time zones UTC+1 to UTC+1 only");
  assert.equal(b.region_text, "Worldwide (no location restrictions listed on Himalayas)");
  assert.equal(checkNigeriaEligibility(a.region_text, "", a.title).status, "open");
});
