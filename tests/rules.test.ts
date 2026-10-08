import { test } from "node:test";
import assert from "node:assert/strict";
import { checkNigeriaEligibility as ng } from "@/lib/eligibility";
import { assessScam } from "@/lib/scam";
import { isRelevantTitle } from "@/lib/relevance";
import { parseWwrRss } from "@/lib/sources/weworkremotely";
import { findPlaceholders, stripHtml } from "@/lib/util";

test("Nigeria eligibility", () => {
  assert.equal(ng("Worldwide", "").eligible, true);
  assert.equal(ng("Nigeria, Kenya", "").eligible, true);
  assert.equal(ng("Europe, Africa", "").eligible, true);
  assert.equal(ng("USA Only", "").eligible, false);
  assert.equal(ng("Remote - US", "").eligible, false);
  assert.equal(ng("Philippines", "").eligible, false);
  assert.equal(ng("", "We are a US-only team.").eligible, false);
  assert.equal(ng("Anywhere", "Must be authorized to work in the United States.").eligible, false);
  assert.equal(ng("Worldwide", "Hiring everywhere except Nigeria and Ghana.").eligible, false);
  assert.equal(ng("", "Open to applicants worldwide").eligible, true);
  assert.equal(ng("EMEA", "").eligible, null);
  assert.equal(ng("", "").eligible, null);
});

test("scam rules flag a classic scam and pass a normal post", () => {
  const bad = assessScam({
    title: "Virtual Assistant",
    company: "",
    description:
      "Earn $5,000 per week! No interview. Message us on Telegram to apply. You will pay a small fee for the starter kit. Send your BVN. contact hr.jobs@gmail.com",
  });
  assert.equal(bad.level, "high");
  for (const id of ["pay_to_apply", "sensitive_info", "chat_only", "no_interview", "personal_email"]) {
    assert.ok(bad.flags.some((f) => f.id === id), `expected flag ${id}`);
  }
  const good = assessScam({
    title: "Executive Assistant",
    company: "Acme",
    description: "We are looking for an executive assistant to manage calendars, inbox and travel for our CEO. ".repeat(10),
  });
  assert.equal(good.level, "low");
  assert.equal(good.flags.length, 0);
});

test("title relevance", () => {
  for (const t of ["Virtual Assistant (Part-time)", "Executive Assistant to CEO", "Customer Support Specialist", "Data Entry Clerk", "Social Media Manager"]) {
    assert.ok(isRelevantTitle(t), t);
  }
  for (const t of ["Senior Software Engineer", "Director of Customer Support", "Medical Assistant", "Account Executive"]) {
    assert.ok(!isRelevantTitle(t), t);
  }
  assert.ok(isRelevantTitle("Bookkeeping Helper", ["bookkeeping helper"]));
});

test("WWR RSS parser splits company and title and decodes HTML", () => {
  const jobs = parseWwrRss(
    `<rss><channel><item><title>Acme Ltd: Virtual Assistant</title><region>Anywhere in the World</region><link>https://weworkremotely.com/remote-jobs/acme-va</link><guid>https://weworkremotely.com/remote-jobs/acme-va</guid><pubDate>Tue, 06 Oct 2026 10:00:00 +0000</pubDate><description>&lt;p&gt;Help our &amp;amp; CEO&lt;/p&gt;</description></item></channel></rss>`
  );
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].company, "Acme Ltd");
  assert.equal(jobs[0].title, "Virtual Assistant");
  assert.equal(jobs[0].description, "Help our & CEO");
  assert.equal(jobs[0].posted_at, "2026-10-06T10:00:00.000Z");
});

test("helpers", () => {
  assert.deepEqual(findPlaceholders("Rate: [add rate]. [add phone] [add rate] [x]"), ["[add rate]", "[add phone]"]);
  assert.equal(stripHtml("<ul><li>One</li><li>Two</li></ul>"), "• One\n• Two");
});

test("Remote OK mojibake is repaired, clean text untouched", async () => {
  const { fixMojibake } = await import("@/lib/sources/remoteok");
  assert.equal(fixMojibake("Telefondienst fÃ¼r Tierarztpraxis"), "Telefondienst für Tierarztpraxis");
  assert.equal(fixMojibake("Virtual Assistant – für alle"), "Virtual Assistant – für alle");
  assert.equal(fixMojibake("Plain"), "Plain");
});

test("office or hybrid wording overrides a worldwide region", () => {
  const r = ng("Anywhere in the World", "• Location: Buenos Aires, Argentina (Hybrid 1–3 days per week in office)");
  assert.equal(r.eligible, false);
  assert.match(r.reason, /office attendance/);
  assert.equal(ng("Anywhere in the World", "Available to work full-time from our Buenos Aires office.").eligible, false);
  assert.equal(ng("Worldwide", "Fully remote, async team.").eligible, true);
});

test("location limits in the job title are respected", () => {
  assert.equal(ng("Anywhere in the World", "", "Executive Personal Assistant to the Founder (Remote, UAE or Europe)").eligible, false);
  assert.equal(ng("", "", "Customer Support Agent - Remote US").eligible, false);
  assert.equal(ng("Worldwide", "", "Virtual Assistant (Remote, Worldwide)").eligible, true);
  assert.equal(ng("Worldwide", "", "Customer Support Agent (Remote)").eligible, true);
  assert.equal(ng("", "", "VA (Remote, Africa)").eligible, true);
});
