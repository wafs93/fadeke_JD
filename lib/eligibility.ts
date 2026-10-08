import { containsPhrase } from "@/lib/util";

export interface Eligibility {
  eligible: boolean | null;
  reason: string;
}

const OPEN_WORLDWIDE = [
  "worldwide",
  "anywhere",
  "anywhere in the world",
  "global",
  "globally",
  "all countries",
  "any country",
  "any location",
  "work from anywhere",
  "remote anywhere",
];

const AFRICA_OK = ["nigeria", "lagos", "africa", "west africa", "sub-saharan africa", "ng"];

const NIGERIA_EXCLUDED = [
  /\b(except|excluding|not (?:open|available) (?:to|in)|cannot hire (?:in|from)|unable to hire (?:in|from)|no applicants from)\b[^.\n]{0,60}\b(nigeria|africa)\b/i,
];

// Regions that, when they are the whole stated location, leave Nigeria out.
const NON_NG_REGIONS = [
  "usa",
  "us",
  "u.s.",
  "united states",
  "canada",
  "north america",
  "americas",
  "latam",
  "latin america",
  "south america",
  "mexico",
  "brazil",
  "uk",
  "united kingdom",
  "europe",
  "eu",
  "germany",
  "france",
  "spain",
  "netherlands",
  "ireland",
  "poland",
  "portugal",
  "philippines",
  "india",
  "pakistan",
  "asia",
  "apac",
  "australia",
  "new zealand",
  "singapore",
  "south africa",
  "kenya",
  "egypt",
];

const RESTRICTIVE_DESCRIPTION = [
  /\b(us|u\.s\.|usa|united states)[- ]only\b/i,
  /\bmust (?:be|reside|live)(?: located| based| residing)? in (?:the )?(us|u\.s\.|usa|united states|uk|united kingdom|canada|europe|eu|philippines|australia)\b/i,
  /\b(authori[sz]ed|eligible) to work in (?:the )?(us|u\.s\.|usa|united states|uk|united kingdom|canada|eu|australia)\b/i,
  /\b(us|u\.s\.) (?:citizens?|residents?) only\b/i,
  /\bopen to (?:candidates|applicants) (?:based |located )?in (?:the )?(us|u\.s\.|usa|united states|uk|canada|philippines|latin america|latam)(?: only)?\b/i,
  /\bw-?2\b/i,
];

// Office attendance makes a "worldwide" feed region meaningless for her.
const OFFICE_REQUIRED = [
  /\bhybrid\b[^.\n]{0,60}/i,
  /\b\d(?:\s?[–-]\s?\d)? days? (?:per|a) week (?:in|at) (?:the|our) office\b/i,
  /\b(?:work|working|based) (?:full[- ]time )?(?:from|in|at) our [A-Z][\w .]{1,40} office\b/,
  /\b(?:on-?site|in-office) (?:role|position|work|presence)\b/i,
];

/**
 * Can someone in Lagos apply? Deterministic and conservative: true only when
 * the post says it is open worldwide or to Nigeria/Africa; false when it names
 * other countries only, or says so in the description; otherwise null
 * ("check the post").
 */
export function checkNigeriaEligibility(regionText: string, description: string, title = ""): Eligibility {
  const region = regionText.toLowerCase().trim();
  // Titles often carry the real limit, e.g. "Executive Assistant (Remote, UAE or Europe)".
  const titleScope = (title.match(/\(([^)]*)\)|[-–—|]\s*([^-–—|]*remote[^-–—|]*)$/i) ?? []).slice(1).filter(Boolean).join(" ").toLowerCase();
  const desc = description.slice(0, 8000);
  const all = `${region}\n${desc.toLowerCase()}`;

  for (const re of NIGERIA_EXCLUDED) {
    const m = all.match(re);
    if (m) return { eligible: false, reason: `Post excludes Nigeria/Africa: "${m[0].trim()}"` };
  }

  // Explicit mention of Nigeria or Africa in the stated region.
  const africa = AFRICA_OK.find((p) => p !== "ng" && (containsPhrase(region, p) || containsPhrase(titleScope, p)));
  if (africa) return { eligible: true, reason: `Region includes ${africa === "lagos" ? "Lagos" : africa.replace(/\b\w/g, (c) => c.toUpperCase())}` };

  for (const re of RESTRICTIVE_DESCRIPTION) {
    const m = desc.match(re);
    if (m) return { eligible: false, reason: `Description limits location: "${m[0].trim()}"` };
  }

  if (titleScope && !AFRICA_OK.some((p) => p !== "ng" && containsPhrase(titleScope, p)) && !OPEN_WORLDWIDE.some((p) => containsPhrase(titleScope, p))) {
    const named = NON_NG_REGIONS.concat(["uae", "dubai", "middle east", "gulf", "emea"]).filter((r) => containsPhrase(titleScope, r));
    if (named.length > 0) return { eligible: false, reason: `Title limits location: "${titleScope.trim()}"` };
  }

  for (const re of OFFICE_REQUIRED) {
    const m = desc.match(re);
    if (m && !/\b(not|no|never) (?:a )?hybrid\b/i.test(m[0])) {
      return { eligible: false, reason: `Needs office attendance: "${m[0].trim().slice(0, 80)}"` };
    }
  }

  if (OPEN_WORLDWIDE.some((p) => containsPhrase(region, p))) {
    return { eligible: true, reason: `Region says "${regionText.trim()}"` };
  }

  if (/\bemea\b/.test(region)) {
    return { eligible: null, reason: "EMEA usually includes Nigeria, but check the post" };
  }

  if (region) {
    const named = NON_NG_REGIONS.filter((r) => containsPhrase(region, r));
    if (named.length > 0) return { eligible: false, reason: `Limited to ${regionText.trim()}` };
  }

  // Region empty or unrecognised: look for open-worldwide wording in the description.
  if (/\b(work from anywhere|open to (?:candidates|applicants) (?:from )?(?:anywhere|worldwide|all countries))\b/i.test(desc)) {
    return { eligible: true, reason: "Description says it is open worldwide" };
  }
  if (/\b(nigeria|africa)\b/i.test(desc)) {
    return { eligible: null, reason: "Description mentions Nigeria or Africa; check the details" };
  }

  return { eligible: null, reason: region ? `Region "${regionText.trim()}" is unclear` : "Region not stated" };
}
