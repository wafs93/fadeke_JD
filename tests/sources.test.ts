import { test } from "node:test";
import assert from "node:assert/strict";
import { mapAshby, mapGreenhouse, mapLever, mapWorkable } from "@/lib/sources/ats";
import { mapWorkingNomads } from "@/lib/sources/workingnomads";
import { companiesFor, loadCompanies } from "@/lib/sources/companies";
import { checkNigeriaEligibility } from "@/lib/eligibility";
import { isRelevantTitle } from "@/lib/relevance";

const co = (board: "greenhouse" | "lever" | "ashby" | "workable", slug = "acme") => ({ board, slug, name: "Acme" });

test("companies config is valid and covers all four boards", () => {
  const all = loadCompanies();
  assert.ok(all.length >= 8);
  for (const b of ["greenhouse", "lever", "ashby", "workable"] as const) assert.ok(companiesFor(b).length > 0, b);
  assert.throws(() => loadCompanies({ companies: [{ board: "bamboo", slug: "x", name: "X" }] }), /companies.json/);
  assert.throws(() => loadCompanies({ companies: [{ board: "lever", slug: "../etc", name: "X" }] }), /slug/);
});

test("Greenhouse: decodes escaped HTML, joins offices, prefers first_published", () => {
  const [j] = mapGreenhouse(co("greenhouse"), {
    jobs: [
      {
        id: 8242239,
        title: "Customer Support Specialist",
        absolute_url: "https://job-boards.greenhouse.io/acme/jobs/8242239",
        location: { name: "APAC Remote; EMEA Remote" },
        offices: [{ name: "APAC Remote" }, { name: "Africa Remote" }],
        content: "&lt;h3&gt;About&lt;/h3&gt;&lt;p&gt;Help customers &amp;amp; teams.&lt;/p&gt;",
        updated_at: "2026-10-05T23:13:23-04:00",
        first_published: "2026-09-30T14:35:59-04:00",
      },
    ],
  });
  assert.equal(j.external_id, "acme:8242239");
  assert.equal(j.company, "Acme");
  assert.equal(j.description, "About\nHelp customers & teams.");
  assert.equal(j.region_text, "APAC Remote; EMEA Remote; Africa Remote");
  assert.equal(j.posted_at, "2026-09-30T18:35:59.000Z");
  assert.equal(checkNigeriaEligibility(j.region_text, j.description, j.title).status, "open");
});

test("Lever: combines description and lists, marks hybrid/on-site", () => {
  const jobs = mapLever(co("lever"), [
    {
      id: "164e09f2",
      text: "Executive Assistant",
      hostedUrl: "https://jobs.lever.co/acme/164e09f2",
      categories: { location: "Global", allLocations: ["Global"] },
      workplaceType: "remote",
      createdAt: 1772012537082,
      descriptionPlain: "Support our founders.",
      lists: [{ text: "What you'll do", content: "<li>Inbox</li><li>Calendar</li>" }],
      salaryRange: { min: 1000, max: 1500, currency: "USD", interval: "per-month-salary" },
    },
    { id: "b", text: "Office Coordinator", hostedUrl: "https://jobs.lever.co/acme/b", categories: { location: "London" }, workplaceType: "hybrid" },
  ]);
  assert.equal(jobs[0].region_text, "Global");
  assert.match(jobs[0].description, /Support our founders[\s\S]*Inbox/);
  assert.equal(jobs[0].salary_text, "USD 1000–1500 per-month-salary");
  assert.equal(jobs[0].posted_at, new Date(1772012537082).toISOString());
  assert.equal(jobs[1].region_text, "London · Hybrid");
  assert.equal(checkNigeriaEligibility(jobs[0].region_text, "", jobs[0].title).status, "open");
  assert.equal(checkNigeriaEligibility(jobs[1].region_text, "", jobs[1].title).status, "closed");
});

test("Ashby: locations, workplace type, unlisted jobs skipped", () => {
  const jobs = mapAshby(co("ashby"), {
    jobs: [
      {
        id: "0be1",
        title: "Customer Support Associate",
        location: "Remote (EMEA)",
        secondaryLocations: [{ location: "Lagos, Nigeria" }],
        workplaceType: "Remote",
        descriptionPlain: "Answer customer emails.",
        publishedAt: "2026-09-18T08:41:19.683+00:00",
        jobUrl: "https://jobs.ashbyhq.com/acme/0be1",
        isListed: true,
      },
      { id: "x", title: "Hidden", jobUrl: "https://jobs.ashbyhq.com/acme/x", isListed: false },
      { id: "y", title: "Admin Assistant", location: "Austin, TX", workplaceType: "OnSite", jobUrl: "https://jobs.ashbyhq.com/acme/y" },
    ],
  });
  assert.equal(jobs.length, 2);
  assert.equal(jobs[0].region_text, "Remote (EMEA); Lagos, Nigeria");
  assert.equal(checkNigeriaEligibility(jobs[0].region_text, jobs[0].description, jobs[0].title).status, "open");
  assert.equal(jobs[1].region_text, "Austin, TX · On-site role");
  assert.equal(checkNigeriaEligibility(jobs[1].region_text, "", jobs[1].title).status, "closed");
});

test("Workable: remote vs office, locations list", () => {
  const jobs = mapWorkable(co("workable"), {
    jobs: [
      {
        title: "Data Entry Associate",
        shortcode: "3FA3",
        url: "https://apply.workable.com/j/3FA3",
        telecommuting: true,
        locations: [{ country: "Kenya", countryCode: "KE", city: "Nairobi", region: "Nairobi" } as never],
        description: "<p>Remote across Africa.</p>",
        published_on: "2026-09-28",
      },
      {
        title: "Accountant",
        shortcode: "9B",
        url: "https://apply.workable.com/j/9B",
        telecommuting: false,
        country: "Nepal",
        city: "Kathmandu",
        state: "Bagmati Province",
      },
    ],
  });
  assert.equal(jobs[0].region_text, "Remote · Nairobi, Kenya");
  assert.equal(jobs[0].posted_at, "2026-09-28T00:00:00.000Z");
  assert.equal(jobs[1].region_text, "Kathmandu, Bagmati Province, Nepal · On-site role");
  assert.equal(checkNigeriaEligibility(jobs[1].region_text, "", jobs[1].title).status, "closed");
});

test("Working Nomads: maps fields and keeps the listing URL as the id", () => {
  const [j] = mapWorkingNomads([
    {
      url: "https://www.workingnomads.com/jobs/virtual-assistant-acme",
      title: "Virtual Assistant",
      description: "<p>Work from anywhere.</p>",
      company_name: "Acme",
      category_name: "Administration",
      location: "Anywhere",
      pub_date: "2026-10-08T16:54:14.000Z",
    },
    { title: "no url" } as never,
  ]);
  assert.equal(j.external_id, j.url);
  assert.equal(j.company, "Acme");
  assert.equal(checkNigeriaEligibility(j.region_text, j.description, j.title).status, "open");
});

test("wider title filter: admin, support, social media and coordinator roles, but not technical admins", () => {
  for (const t of ["Office Administrator", "Support Associate", "Social Media Specialist", "Operations Coordinator", "Community Manager"]) {
    assert.ok(isRelevantTitle(t), t);
  }
  for (const t of ["Systems Administrator", "Database Administrator", "Clinical Coordinator", "Inside Sales Representative"]) {
    assert.ok(!isRelevantTitle(t), t);
  }
});
