import { test } from "node:test";
import assert from "node:assert/strict";
import { composeCv, formatAnswers } from "@/lib/kit";
import { checkKit } from "@/lib/kit-checks";
import { cvToDocx } from "@/lib/docx";
import type { ProfileBundle } from "@/lib/profile";

const bundle: ProfileBundle = {
  profile: {
    user_id: "u",
    full_name: "Ada Example",
    email: null,
    phone: null,
    location: "Lagos, Nigeria",
    timezone: "WAT, UTC+1",
    target_titles: [],
    min_hourly_rate: null,
    summary: "Organised VA.",
    skills: ["Email Management", "Calendar Organization"],
    tools: ["Google Suite"],
    languages: ["English (expert)"],
  },
  experiences: [
    {
      id: "e1", user_id: "u", employer: "Example Studio", title: "Virtual Assistant", start_date: "2024-02-01", end_date: null,
      current: true, location: null, remote: true, verified: true, sort_order: 0,
      bullets: [{ text: "Managed the founder's inbox.", tags: [] }, { text: "Checked 100+ products daily.", tags: [] }],
    },
    {
      id: "e2", user_id: "u", employer: "Unconfirmed Co", title: "Virtual Assistant", start_date: null, end_date: null,
      current: false, location: null, remote: true, verified: false, sort_order: 1,
      bullets: [{ text: "SECRET DUTY", tags: [] }],
    },
  ],
  education: [],
};

test("CV uses only confirmed facts and drops unknown skills", () => {
  const cv = composeCv(bundle, { summary: "Tailored.", skills: ["Python", "Email Management"], bullet_order: [{ id: "e1", order: [1, 9, 1] }] });
  assert.ok(!cv.includes("Unconfirmed Co"));
  assert.ok(!cv.includes("SECRET DUTY"));
  assert.ok(!cv.includes("Python"));
  assert.ok(cv.includes("[add email]") && cv.includes("[add phone]"));
  assert.ok(cv.indexOf("Checked 100+") < cv.indexOf("Managed the founder"));
});

test("fact check flags invented numbers, unconfirmed employers and placeholders", () => {
  const cv = composeCv(bundle, { summary: "x", skills: [], bullet_order: [] });
  const res = checkKit(
    {
      cv_text: cv,
      cover_letter: "At Unconfirmed Co I handled 100+ products.",
      answers_text: formatAnswers([{ question: "Rate?", answer: "[add rate], with 7 years of experience." }]),
    },
    bundle,
    "Executive assistant, 20 hours a week"
  );
  assert.deepEqual(res.unknownNumbers, ["7"]);
  assert.deepEqual(res.unconfirmedMentions, ["Unconfirmed Co"]);
  assert.ok(res.placeholders.some((p) => p.doc === "Answers" && p.items.includes("[add rate]")));
});

test("docx export produces a Word file", async () => {
  const buf = await cvToDocx(composeCv(bundle, { summary: "x", skills: [], bullet_order: [] }));
  assert.equal(buf.subarray(0, 2).toString(), "PK");
});

test("fact check flags availability, travel, office and soft-skill claims", () => {
  const cv = composeCv(bundle, { summary: "x", skills: [], bullet_order: [] });
  const res = checkKit(
    {
      cv_text: cv,
      cover_letter:
        "I am available to work full-time and open to any travel requirements. I will support your Buenos Aires office. I have strong problem-solving skills and can quickly adapt.",
      answers_text: "Q: Start?\nA: [add start date].",
    },
    bundle,
    "Executive assistant"
  );
  const labels = res.unsupportedClaims.map((c) => c.split(":")[0]);
  for (const l of ["availability or hours", "travel or relocation", "office attendance", "soft-skill claims", "learning promises"]) {
    assert.ok(labels.includes(l), `expected ${l}`);
  }
  const clean = checkKit({ cv_text: cv, cover_letter: "I manage the founder's inbox.", answers_text: "" }, bundle, "");
  assert.deepEqual(clean.unsupportedClaims, []);
});

test("fact check flags pay agreement and inflated wording", () => {
  const cv = composeCv(bundle, { summary: "x", skills: [], bullet_order: [] });
  const res = checkKit(
    {
      cv_text: cv,
      cover_letter: "I have extensive experience with online systems and a proven track record.",
      answers_text: "Q: Pay?\nA: The role pays $20 per hour. I am comfortable with this pay structure.",
    },
    bundle,
    "Pays $20 per hour"
  );
  const labels = res.unsupportedClaims.map((c) => c.split(":")[0]);
  assert.ok(labels.includes("inflated wording"));
  assert.ok(labels.includes("pay agreement"));
});

test("fact check flags invented stories and results written in words", () => {
  const cv = composeCv(bundle, { summary: "x", skills: [], bullet_order: [] });
  const res = checkKit(
    {
      cv_text: cv,
      cover_letter: "",
      answers_text:
        "Q: Describe a trip you booked that went wrong and how you fixed it.\nA: When a flight was cancelled I rebooked the team.\n\n" +
        "Q: Describe one repetitive task you automated.\nA: I built a template that saved approximately two hours per week.\n\n" +
        "Q: Give an example of handling a complaint.\nA: I handle client enquiries. [add your own example: a complaint you resolved]",
    },
    bundle,
    ""
  );
  const stories = res.unsupportedClaims.filter((c) => c.startsWith("story to verify"));
  assert.equal(stories.length, 2);
  assert.ok(res.unsupportedClaims.some((c) => c.startsWith("result to verify")));
});
