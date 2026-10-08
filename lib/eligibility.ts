import { containsPhrase } from "@/lib/util";

/**
 * Can someone living in Lagos apply?
 *
 *  - open:    the post explicitly allows Nigeria (worldwide, anywhere, global,
 *             Africa, Nigeria, Lagos, all countries, or a list naming Nigeria)
 *  - closed:  anything that excludes her (country-only wording, residency,
 *             work authorisation, visas, citizenship, US/AU time zones,
 *             on-site/hybrid, or a place list without Nigeria)
 *  - unclear: neither, e.g. "Remote" with no location, or only EMEA/Europe
 *
 * Closed signals always win over open ones: the priority is never to show a
 * job she cannot apply for. Only "open" jobs reach the main feed.
 */
export type NgStatus = "open" | "closed" | "unclear";

export interface Eligibility {
  status: NgStatus;
  /** Stored in jobs.ng_eligible: true = open, false = closed, null = unclear. */
  eligible: boolean | null;
  reason: string;
  /** Short phrase quoted from the post that supports the decision. */
  evidence: string | null;
}

export function statusToEligible(status: NgStatus): boolean | null {
  return status === "open" ? true : status === "closed" ? false : null;
}

export function eligibleToStatus(eligible: boolean | null): NgStatus {
  return eligible === true ? "open" : eligible === false ? "closed" : "unclear";
}

// ---------------------------------------------------------------------------
// Place names
// ---------------------------------------------------------------------------

const COUNTRIES = [
  "united states", "united states of america", "usa", "u.s.a", "u.s.", "america", "canada", "mexico", "brazil",
  "argentina", "colombia", "chile", "peru", "uruguay", "costa rica", "united kingdom", "u.k.", "great britain",
  "britain", "england", "scotland", "wales", "northern ireland", "ireland", "germany", "france", "spain", "portugal",
  "italy", "netherlands", "belgium", "luxembourg", "switzerland", "austria", "poland", "sweden", "norway", "denmark",
  "finland", "iceland", "estonia", "latvia", "lithuania", "czech republic", "czechia", "slovakia", "slovenia",
  "croatia", "serbia", "romania", "bulgaria", "greece", "cyprus", "malta", "hungary", "ukraine", "moldova",
  "georgia", "armenia", "turkey", "türkiye", "israel", "uae", "united arab emirates", "dubai", "abu dhabi",
  "saudi arabia", "qatar", "kuwait", "bahrain", "oman", "jordan", "lebanon", "egypt", "morocco", "tunisia",
  "kenya", "south africa", "ghana", "uganda", "rwanda", "ethiopia", "tanzania", "india", "pakistan", "bangladesh",
  "sri lanka", "nepal", "philippines", "indonesia", "malaysia", "singapore", "thailand", "vietnam", "china",
  "japan", "korea", "south korea", "taiwan", "hong kong", "australia", "new zealand",
];

const REGIONS = [
  "north america", "latin america", "latam", "south america", "central america", "the americas", "americas",
  "apac", "asia pacific", "asia", "southeast asia", "oceania", "anz", "middle east", "mena", "gulf", "gcc",
  "cee", "eastern europe", "western europe", "nordics", "scandinavia", "dach", "benelux", "baltics",
];

const US_STATES = [
  "alabama", "alaska", "arizona", "arkansas", "california", "colorado", "connecticut", "delaware", "florida",
  "hawaii", "idaho", "illinois", "indiana", "iowa", "kansas", "kentucky", "louisiana", "maine", "maryland",
  "massachusetts", "michigan", "minnesota", "mississippi", "missouri", "montana", "nebraska", "nevada",
  "new hampshire", "new jersey", "new mexico", "new york", "north carolina", "north dakota", "ohio", "oklahoma",
  "oregon", "pennsylvania", "rhode island", "south carolina", "south dakota", "tennessee", "texas", "utah",
  "vermont", "virginia", "washington", "west virginia", "wisconsin", "wyoming",
];

const CITIES = [
  "london", "manchester", "new york city", "nyc", "san francisco", "los angeles", "chicago", "austin", "seattle",
  "boston", "miami", "denver", "atlanta", "toronto", "vancouver", "montreal", "berlin", "munich", "paris",
  "amsterdam", "madrid", "barcelona", "lisbon", "dublin", "zurich", "stockholm", "copenhagen", "warsaw",
  "manila", "cebu", "bangalore", "bengaluru", "mumbai", "delhi", "sydney", "melbourne", "tel aviv",
  "buenos aires", "sao paulo", "são paulo", "mexico city", "bogota", "bogotá", "nairobi", "cape town",
  "johannesburg", "cairo", "accra", "tokyo", "seoul",
];

// Case-sensitive short codes, so "us" in "join us" never counts as a country.
const PLACE_CODES = /(^|[^A-Za-z])(US|USA|U\.S\.?|UK|U\.K\.|GB|CA|AU|NZ|UAE|KSA|PH|LATAM|APAC)([^A-Za-z]|$)/;
// "City, ST" style US addresses.
const US_STATE_CODE = /,\s*(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)\b/;

// Europe / EMEA only: not explicit about Nigeria either way.
const EUROPE_GROUP = ["emea", "europe", "european union", "eu", "european time zones", "european timezone"];

const AFRICA = /(?<!south\s)\bafrica(?:n)?\b|\bafrica-based\b/i;
const NIGERIA = /\b(nigeria|nigerian|lagos)\b/i;
const WORLD = /\b(worldwide|world-wide|anywhere|global|globally|all countries|any country|around the world|all over the world|international(?:ly)?)\b/i;

function namesNigeriaOrAfrica(text: string): boolean {
  return NIGERIA.test(text) || AFRICA.test(text);
}

function placeNamed(text: string, { includeEurope = false } = {}): string | null {
  const lower = text.toLowerCase();
  for (const list of [COUNTRIES, REGIONS, US_STATES, CITIES]) {
    const hit = list.find((p) => containsPhrase(lower, p));
    if (hit) return hit;
  }
  const code = text.match(PLACE_CODES);
  if (code) return code[2];
  const state = text.match(US_STATE_CODE);
  if (state) return state[1];
  if (includeEurope) {
    const eu = EUROPE_GROUP.find((p) => containsPhrase(lower, p));
    if (eu) return eu;
  }
  return null;
}

/** For a captured place phrase ("in the US and Canada"): open, closed or neither. */
function judgePlace(capture: string): "open" | "closed" | null {
  if (namesNigeriaOrAfrica(capture) || /\b(world|globe|anywhere|any country|all countries)\b/i.test(capture)) return "open";
  if (placeNamed(capture, { includeEurope: true })) return "closed";
  return null;
}

function snippet(text: string, index: number, length: number, pad = 0): string {
  const start = Math.max(0, index - pad);
  const end = Math.min(text.length, index + length + pad);
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}

const NEGATED = /\b(no|not|non|never|without|zero)\b[\s-]*$/i;

function firstMatch(text: string, re: RegExp, allowNegated = false): { phrase: string; groups: string[] } | null {
  const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : `${re.flags}g`);
  let m: RegExpExecArray | null;
  while ((m = g.exec(text))) {
    const before = text.slice(Math.max(0, m.index - 20), m.index);
    if (!allowNegated && NEGATED.test(before)) continue;
    return { phrase: snippet(text, m.index, m[0].length), groups: m.slice(1).map((s) => s ?? "") };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Closed signals
// ---------------------------------------------------------------------------

interface Rule {
  re: RegExp;
  reason: string;
  /** Group index holding a place; the rule only closes if that place excludes Nigeria. */
  placeGroup?: number;
}

const COUNTRY_ADJ =
  "US|USA|U\\.S\\.|UK|U\\.K\\.|EU|United States|United Kingdom|Canada|Canadian|Australia|Australian|American|British|European|North America|LATAM";

const CLOSED_RULES: Rule[] = [
  { re: new RegExp(`\\b(?:${COUNTRY_ADJ})[- ](?:only|residents? only|citizens? only)\\b`), reason: "Limited to one country or region" },
  { re: /\b(?:united states|united kingdom|canada|australia|north america)[- ]only\b/i, reason: "Limited to one country or region" },
  { re: new RegExp(`\\b(?:${COUNTRY_ADJ})[- ]based (?:candidates|applicants)\\b`), reason: "Wants candidates based in another country" },
  { re: /\bonly (?:open|available|accepting|hiring|considering)\b[^.\n]{0,40}?\b(?:in|from|to)\s+(?:the\s+)?([^.\n;:]{2,80})/i, reason: "Only open to certain places", placeGroup: 1 },
  { re: /\bmust (?:currently )?(?:reside|be located|be based|live|be living|be residing|be resident)\s+(?:in|within)\s+(?:the\s+)?([^.\n;:]{2,80})/i, reason: "Must live in a named place", placeGroup: 1 },
  { re: /\b(?:candidates|applicants|you) (?:must|should|need to) be (?:based|located|residing|living) (?:in|within) (?:the\s+)?([^.\n;:]{2,80})/i, reason: "Must live in a named place", placeGroup: 1 },
  { re: /\b(?:authori[sz]ed|eligible|legally (?:able|allowed|permitted)|permitted|entitled) to work (?:in|for) (?:the\s+)?([^.\n;:,]{2,60})/i, reason: "Needs the right to work in another country", placeGroup: 1 },
  { re: /\bright to work in (?:the\s+)?([^.\n;:,]{2,60})/i, reason: "Needs the right to work in another country", placeGroup: 1 },
  { re: /\bwork (?:permit|visa|authori[sz]ation) (?:is )?required\b|\bvalid work permit\b|\bmust (?:hold|have) (?:a )?(?:valid )?work (?:permit|visa)\b/i, reason: "Needs a work permit" },
  { re: /\b(?:visa )?sponsorship (?:is )?(?:not |un)(?:available|provided|offered|possible)\b|\b(?:no|not able to|unable to|cannot|can't|can not|do not|don't|will not|won't|are not able to) (?:offer |provide )?(?:visa )?sponsor(?:ship)?\b|\bwithout (?:the )?need for (?:visa )?sponsorship\b/i, reason: "No visa sponsorship" },
  { re: /\bcitizens? only\b|\bcitizenship (?:is )?required\b|\bmust be (?:a )?(?:US |U\.S\. |UK |EU |Canadian |Australian |American |British )?citizen\b|\bgreen card\b|\bsecurity clearance\b/i, reason: "Citizenship or clearance required" },
  { re: /\bW-?2\b|\b1099 contractor\b|\bSSN\b/, reason: "US tax or payroll status required" },
  { re: /\b(?:EST|EDT|PST|PDT|CST|CDT|MST|MDT|AEST|AEDT|AWST)\b|\b(?:ET|PT|CT|MT)\s+(?:hours|time|timezone|time zone|business hours)\b/, reason: "Works US or Australian hours" },
  { re: /\b(?:PT|ET|CT|MT)\s*(?:or|\/|and|&)\s*(?:PT|ET|CT|MT)\b|\b[Tt]ime ?[Zz]one\s*[:\-–]?\s*(?:PT|ET|CT|MT|Pacific|Eastern|Central|Mountain)\b/, reason: "Works US hours" },
  // Codes are case-sensitive so "give us hours" or "overlap with us" never match.
  { re: /\b(?:US|U\.S\.)\s+(?:time ?zones?|business hours|working hours|hours|time)\b/, reason: "Works US hours" },
  { re: /\b(?:north american?|american|australian|pacific|eastern|central|mountain)\s+(?:time ?zones?|business hours|working hours|standard time|hours|time)\b/i, reason: "Works US or Australian hours" },
  { re: /\b(?:[Oo]verlap|[Aa]lign) (?:with|to) (?:the\s+)?(?:US|U\.S\.|North America|Pacific|Eastern|Australia)/, reason: "Works US or Australian hours" },
  { re: /\bhybrid\b/i, reason: "Hybrid role (office attendance)" },
  // Only when it describes the job itself, not meetings, events or other staff.
  { re: /\b(?:on-?site|in[- ]office|in[- ]person) (?:role|position|job|work|presence|attendance|requirement)\b|\b(?:this|the) (?:role|position|job) is (?:fully )?(?:on-?site|in[- ]office|in[- ]person)\b|\b(?:on-?site|in[- ]office|in[- ]person) (?:in|at) [A-Z][a-z]+/, reason: "On-site role" },
  { re: /\b\d(?:\s?[–-]\s?\d)? days? (?:per|a) week (?:in|at) (?:the|our) office\b/i, reason: "Office attendance required" },
  { re: /\b(?:work|working|based) (?:full[- ]time )?(?:from|in|at) our [A-Z][\w .]{1,40} office\b/, reason: "Office attendance required" },
  { re: /\b(?:relocation|relocate) (?:is )?(?:required|to)\b|\bwilling to relocate\b/i, reason: "Relocation required" },
  { re: /\banywhere in (?:the\s+)?([^.\n;:,]{2,40})/i, reason: "\"Anywhere\" only within a named place", placeGroup: 1 },
];

const EXCLUDES_NIGERIA =
  /\b(?:except|excluding|exclude|not (?:open|available|eligible) (?:to|in|for)|cannot (?:hire|accept|work with)[^.\n]{0,20}?(?:in|from)|unable to hire[^.\n]{0,20}?(?:in|from)|no (?:applicants|candidates) from|not (?:hiring|accepting)[^.\n]{0,20}?(?:in|from))\b[^.\n]{0,60}\b(?:nigeria|africa)\b/i;

// ---------------------------------------------------------------------------
// Open signals
// ---------------------------------------------------------------------------

const OPEN_DESCRIPTION = [
  /\b(?:work|working|apply|hire|hiring|join us|open to (?:candidates|applicants|people|talent)?)\s*from anywhere\b/i,
  /\banywhere in the world\b/i,
  /\b(?:fully |100% )?remote[ ,(-]+(?:worldwide|global|anywhere)\b/i,
  /\b(?:hiring|hire|recruit(?:ing)?|open|available|work) (?:globally|worldwide|internationally)\b/i,
  /\bopen to (?:candidates|applicants|talent|people|contractors) (?:from |in |based in |located in )?(?:all countries|any country|anywhere|around the world|all over the world|worldwide)\b/i,
  /\b(?:from|in) (?:all|any) countr(?:y|ies)\b/i,
  /\bregardless of (?:your )?(?:location|where you live|country)\b/i,
  /\bno location restrictions?\b/i,
  /\blocation[- ]independent\b/i,
];

const OPEN_TO_PLACES = /\b(?:open to|accepting|hiring|welcome|welcoming|considering) (?:applications |candidates |applicants |talent |people |contractors )?(?:from|in|based in|located in|across)\s+([^.\n;:]{2,120})/i;

// ---------------------------------------------------------------------------

function titleTags(title: string): string {
  const tags: string[] = [];
  for (const m of title.matchAll(/[([]([^)\]]{1,60})[)\]]/g)) tags.push(m[1]);
  const tail = title.match(/(?:\s[-–—|]\s|,\s)([^-–—|,]{2,40})$/);
  if (tail) tags.push(tail[1]);
  return tags.join(" · ");
}

function closed(reason: string, evidence: string): Eligibility {
  return { status: "closed", eligible: false, reason: `${reason}: "${evidence}"`, evidence };
}

function open(reason: string, evidence: string): Eligibility {
  return { status: "open", eligible: true, reason: `${reason}: "${evidence}"`, evidence };
}

export function checkNigeriaEligibility(regionText: string, description: string, title = ""): Eligibility {
  const region = regionText.replace(/\s+/g, " ").trim();
  const tags = titleTags(title);
  const desc = description.slice(0, 12000);
  const all = [title, region, desc].filter(Boolean).join("\n");

  // 1. Explicit exclusion of Nigeria or Africa.
  const excl = firstMatch(all, EXCLUDES_NIGERIA, true);
  if (excl) return closed("Excludes Nigeria", excl.phrase);

  // 2a. A listed time-zone range that leaves out Lagos (UTC+1).
  const tz = all.match(/\bTime zones UTC([+-]\d+(?:\.\d+)?) to UTC([+-]\d+(?:\.\d+)?) only\b/);
  if (tz && (1 < Number(tz[1]) || 1 > Number(tz[2]))) return closed("Time zones exclude Lagos (UTC+1)", tz[0]);

  // 2b. Wording that rules her out.
  for (const rule of CLOSED_RULES) {
    const m = firstMatch(all, rule.re);
    if (!m) continue;
    if (rule.placeGroup !== undefined) {
      const verdict = judgePlace(m.groups[rule.placeGroup - 1]);
      if (verdict !== "closed") continue;
    }
    return closed(rule.reason, m.phrase);
  }

  // 3. Explicit "open to candidates in X, Y, Z" lists.
  const list = firstMatch(all, OPEN_TO_PLACES);
  if (list) {
    const verdict = judgePlace(list.groups[0]);
    if (verdict === "closed") return closed("Open only to other places", list.phrase);
    if (verdict === "open") return open("Post lists Nigeria, Africa or anywhere", list.phrase);
  }

  // 4. Location field and title tags naming places without Nigeria.
  for (const [label, text] of [["Location", region], ["Title", tags]] as const) {
    if (!text || namesNigeriaOrAfrica(text) || WORLD.test(text)) continue;
    const place = placeNamed(text);
    if (place) return closed(`${label} limited to ${place.toUpperCase().length <= 4 ? place.toUpperCase() : place}`, text);
  }

  // 5. Open signals: Nigeria, Lagos, Africa, worldwide, anywhere, global.
  const ng = firstMatch(all, NIGERIA);
  if (ng) return open("Mentions Nigeria", ng.phrase);
  const af = firstMatch(all, AFRICA);
  if (af) return open("Open to Africa", af.phrase);
  for (const text of [region, tags]) {
    const w = text ? firstMatch(text, WORLD) : null;
    if (w) return open("Location says", text.length <= 60 ? text : w.phrase);
  }
  for (const re of OPEN_DESCRIPTION) {
    const m = firstMatch(desc, re);
    if (m) return open("Post says", m.phrase);
  }

  // 6. Unclear.
  const eu = EUROPE_GROUP.find((p) => containsPhrase(`${region} ${tags} ${desc.slice(0, 2000)}`.toLowerCase(), p));
  if (eu) {
    return { status: "unclear", eligible: null, reason: `Only mentions ${eu === "emea" ? "EMEA" : "Europe"}; Nigeria not stated`, evidence: null };
  }
  return {
    status: "unclear",
    eligible: null,
    reason: region ? `Location "${region}" does not say whether Nigeria is allowed` : "Location not stated",
    evidence: null,
  };
}

/** A quote that can support "open" must itself say the job is open broadly
 * or to Nigeria/Africa. Used to check the small model's answers. */
export function quoteSupportsOpen(quote: string): boolean {
  if (judgePlace(quote) === "closed" && !namesNigeriaOrAfrica(quote)) return false;
  return (
    namesNigeriaOrAfrica(quote) ||
    /\b(anywhere|worldwide|world-wide|globally|global|all countries|any country|around the world|all over the world|internationally|regardless of (?:your )?(?:location|country)|no location restrictions?|location[- ]independent)\b/i.test(quote)
  );
}
