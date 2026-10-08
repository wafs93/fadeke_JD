import type { JobSource } from "@/lib/sources/types";
import { companiesFor, type Board, type Company } from "@/lib/sources/companies";
import type { RawJob } from "@/lib/types";
import { fetchWithTimeout, stripHtml, toIsoOrNull } from "@/lib/util";

// Public job board APIs of applicant tracking systems, read per company from
// config/companies.json. All four are published for building job boards and
// need no key:
//   Greenhouse  boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true
//   Lever       api.lever.co/v0/postings/{slug}?mode=json
//   Ashby       api.ashbyhq.com/posting-api/job-board/{slug}
//   Workable    apply.workable.com/api/v1/widget/accounts/{slug}?details=true
// One request per company per run, at most every 6 hours, with links back to
// each company's own posting.

function uniqueJoin(parts: (string | null | undefined)[], sep = "; "): string {
  // Some boards already pack several places into one string ("APAC Remote; EMEA Remote").
  const items = parts.flatMap((p) => (p ?? "").split(sep === "; " ? ";" : "\u0000")).map((p) => p.trim());
  return Array.from(new Set(items.filter(Boolean))).join(sep);
}

/** Appends on-site/hybrid wording the eligibility rules understand. */
function workplaceSuffix(type: string | null | undefined): string {
  const t = (type ?? "").toLowerCase().replace(/[^a-z]/g, "");
  if (t === "hybrid") return " · Hybrid";
  if (t === "onsite") return " · On-site role";
  return "";
}

// --- Greenhouse -------------------------------------------------------------

interface GreenhouseJob {
  id: number;
  title: string;
  absolute_url: string;
  location?: { name?: string };
  offices?: { name?: string }[];
  content?: string;
  updated_at?: string;
  first_published?: string;
  company_name?: string;
}

export function mapGreenhouse(company: Company, body: { jobs?: GreenhouseJob[] }): RawJob[] {
  return (body.jobs ?? [])
    .filter((j) => j?.id && j.title && j.absolute_url)
    .map((j) => ({
      source: "greenhouse",
      external_id: `${company.slug}:${j.id}`,
      title: j.title.trim(),
      company: company.name || j.company_name || company.slug,
      url: j.absolute_url,
      description: stripHtml(j.content),
      region_text: uniqueJoin([j.location?.name, ...(j.offices ?? []).map((o) => o.name)]),
      posted_at: toIsoOrNull(j.first_published ?? j.updated_at),
      salary_text: null,
    }));
}

// --- Lever ------------------------------------------------------------------

interface LeverJob {
  id: string;
  text: string;
  hostedUrl: string;
  categories?: { location?: string; allLocations?: string[]; commitment?: string };
  workplaceType?: string;
  createdAt?: number;
  descriptionPlain?: string;
  lists?: { text?: string; content?: string }[];
  additionalPlain?: string;
  salaryRange?: { min?: number; max?: number; currency?: string; interval?: string };
}

export function mapLever(company: Company, body: LeverJob[]): RawJob[] {
  return (Array.isArray(body) ? body : [])
    .filter((j) => j?.id && j.text && j.hostedUrl)
    .map((j) => {
      const lists = (j.lists ?? []).map((l) => `${l.text ?? ""}\n${stripHtml(l.content)}`).join("\n\n");
      const s = j.salaryRange;
      return {
        source: "lever",
        external_id: `${company.slug}:${j.id}`,
        title: j.text.trim(),
        company: company.name,
        url: j.hostedUrl,
        description: [j.descriptionPlain, lists, j.additionalPlain].filter(Boolean).join("\n\n").trim(),
        region_text:
          uniqueJoin([j.categories?.location, ...(j.categories?.allLocations ?? [])]) + workplaceSuffix(j.workplaceType),
        posted_at: toIsoOrNull(j.createdAt),
        salary_text:
          s && (s.min || s.max) ? `${s.currency ?? ""} ${[s.min, s.max].filter(Boolean).join("–")} ${s.interval ?? ""}`.trim() : null,
      };
    });
}

// --- Ashby ------------------------------------------------------------------

interface AshbyJob {
  id?: string;
  title: string;
  location?: string;
  secondaryLocations?: { location?: string }[];
  isRemote?: boolean;
  workplaceType?: string;
  descriptionPlain?: string;
  descriptionHtml?: string;
  publishedAt?: string;
  jobUrl: string;
  isListed?: boolean;
  address?: { postalAddress?: { addressCountry?: string } };
  compensation?: { compensationTierSummary?: string | null };
}

export function mapAshby(company: Company, body: { jobs?: AshbyJob[] }): RawJob[] {
  return (body.jobs ?? [])
    .filter((j) => j?.title && j.jobUrl && j.isListed !== false)
    .map((j) => ({
      source: "ashby",
      external_id: `${company.slug}:${j.id ?? j.jobUrl}`,
      title: j.title.trim(),
      company: company.name,
      url: j.jobUrl,
      description: (j.descriptionPlain || stripHtml(j.descriptionHtml)).trim(),
      region_text:
        uniqueJoin([j.location, ...(j.secondaryLocations ?? []).map((l) => l.location), j.address?.postalAddress?.addressCountry]) +
        workplaceSuffix(j.workplaceType),
      posted_at: toIsoOrNull(j.publishedAt),
      salary_text: j.compensation?.compensationTierSummary ?? null,
    }));
}

// --- Workable ---------------------------------------------------------------

interface WorkableJob {
  title: string;
  shortcode: string;
  url: string;
  telecommuting?: boolean;
  country?: string;
  city?: string;
  state?: string;
  locations?: { country?: string; city?: string; region?: string }[];
  description?: string;
  published_on?: string;
  created_at?: string;
}

export function mapWorkable(company: Company, body: { jobs?: WorkableJob[] }): RawJob[] {
  return (body.jobs ?? [])
    .filter((j) => j?.shortcode && j.title && j.url)
    .map((j) => {
      const places = (j.locations?.length ? j.locations : [{ city: j.city, region: j.state, country: j.country }]).map((l) =>
        uniqueJoin([l.city, l.region, l.country], ", ")
      );
      return {
        source: "workable",
        external_id: `${company.slug}:${j.shortcode}`,
        title: j.title.trim(),
        company: company.name,
        url: j.url,
        description: stripHtml(j.description),
        // Workable marks remote jobs with telecommuting; anything else is office-based.
        region_text: `${j.telecommuting ? "Remote · " : ""}${uniqueJoin(places)}${j.telecommuting ? "" : " · On-site role"}`.replace(
          /^ · /,
          ""
        ),
        posted_at: toIsoOrNull(j.published_on ?? j.created_at),
        salary_text: null,
      };
    });
}

// --- Sources ----------------------------------------------------------------

const ENDPOINT: Record<Board, (slug: string) => string> = {
  greenhouse: (s) => `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(s)}/jobs?content=true`,
  lever: (s) => `https://api.lever.co/v0/postings/${encodeURIComponent(s)}?mode=json`,
  ashby: (s) => `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(s)}?includeCompensation=true`,
  workable: (s) => `https://apply.workable.com/api/v1/widget/accounts/${encodeURIComponent(s)}?details=true`,
};

// Each board's JSON goes to its own mapper; the casts mark where untyped API
// data meets the typed mappers.
const MAPPER: Record<Board, (c: Company, body: unknown) => RawJob[]> = {
  greenhouse: (c, b) => mapGreenhouse(c, b as Parameters<typeof mapGreenhouse>[1]),
  lever: (c, b) => mapLever(c, b as Parameters<typeof mapLever>[1]),
  ashby: (c, b) => mapAshby(c, b as Parameters<typeof mapAshby>[1]),
  workable: (c, b) => mapWorkable(c, b as Parameters<typeof mapWorkable>[1]),
};

const NAMES: Record<Board, string> = { greenhouse: "Greenhouse", lever: "Lever", ashby: "Ashby", workable: "Workable" };

function atsSource(board: Board): JobSource {
  return {
    id: board,
    name: NAMES[board],
    homepage: ENDPOINT[board]("").split("/v")[0],
    minIntervalMinutes: 6 * 60,
    listsOnlyOpenJobs: true,
    async fetchJobs() {
      const jobs: RawJob[] = [];
      const failures: string[] = [];
      for (const company of companiesFor(board)) {
        try {
          const res = await fetchWithTimeout(ENDPOINT[board](company.slug));
          if (res.status === 429) break; // back off; next run picks up the rest
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          jobs.push(...MAPPER[board](company, await res.json()));
        } catch (e) {
          failures.push(`${company.slug}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
      // One company's board going away shouldn't hide the others' jobs.
      if (failures.length && !jobs.length) throw new Error(`${NAMES[board]}: ${failures.join("; ")}`);
      return jobs;
    },
  };
}

export const greenhouse = atsSource("greenhouse");
export const lever = atsSource("lever");
export const ashby = atsSource("ashby");
export const workable = atsSource("workable");
