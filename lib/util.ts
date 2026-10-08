const ENTITIES: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&#39;": "'",
  "&#039;": "'",
  "&apos;": "'",
  "&quot;": '"',
  "&rsquo;": "'",
  "&lsquo;": "'",
  "&rdquo;": '"',
  "&ldquo;": '"',
  "&ndash;": "–",
  "&mdash;": "—",
  "&hellip;": "…",
  "&bull;": "•",
};

export function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&[a-z]+;|&#0?39;/gi, (m) => ENTITIES[m.toLowerCase()] ?? m);
}

export function stripHtml(html: string | null | undefined): string {
  if (!html) return "";
  // Some feeds double-encode their HTML, so decode once before stripping tags.
  const decoded = /&lt;\/?[a-z]/i.test(html) ? decodeEntities(html) : html;
  return decodeEntities(
    decoded
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<li[^>]*>/gi, "\n• ")
      .replace(/<\/(p|div|li|h[1-6]|ul|ol)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Case-insensitive whole-word/phrase match. Not a bare `.includes()`, which
 * would let "us" match inside "focus" or "bonus". */
export function containsPhrase(text: string, phrase: string): boolean {
  const escaped = phrase.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`, "i").test(text);
}

/** Aborts the request if it hasn't settled within `timeoutMs`. */
export async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 15000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      headers: { "User-Agent": "FadekeJobDesk/1.0 (private, single-user job search)", ...(init.headers ?? {}) },
      signal: controller.signal,
      cache: "no-store",
    });
  } finally {
    clearTimeout(timeout);
  }
}

/** Runs `fn` over `items` with at most `concurrency` in flight at once. */
export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const current = nextIndex++;
      results[current] = await fn(items[current], current);
    }
  }

  const workerCount = Math.max(1, Math.min(concurrency, items.length));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

const LAGOS_TZ = "Africa/Lagos";

/** Today's date in Lagos as YYYY-MM-DD. */
export function todayInLagos(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: LAGOS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Adds whole days to a YYYY-MM-DD date string. */
export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function toIsoOrNull(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  const d = typeof value === "number" ? new Date(value < 1e12 ? value * 1000 : value) : new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function formatPostedAgo(postedAt: string | null): string {
  if (!postedAt) return "Date not given";
  const hours = Math.max(0, Math.floor((Date.now() - new Date(postedAt).getTime()) / 3_600_000));
  if (hours < 1) return "Posted just now";
  if (hours < 24) return `Posted ${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "Posted 1 day ago" : `Posted ${days} days ago`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2024-02-01" -> "Feb 2024". */
export function formatMonth(isoDate: string | null): string {
  if (!isoDate) return "";
  const [y, m] = isoDate.split("-");
  const month = MONTHS[Number(m) - 1];
  return month ? `${month} ${y}` : y;
}

export function formatDateRange(start: string | null, end: string | null, current: boolean): string {
  const from = formatMonth(start);
  const to = current ? "Present" : formatMonth(end);
  if (!from && !to) return "";
  return `${from || "?"} – ${to || "?"}`;
}

/** Square-bracket placeholders like [add rate] that Fadeke must fill in. */
export function findPlaceholders(text: string): string[] {
  const found = text.match(/\[[^\]\n]{2,60}\]/g) ?? [];
  return Array.from(new Set(found));
}

/** Splits free text (one per line or comma-separated) into a clean list. */
export function splitList(text: string): string[] {
  return text
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export const SOURCE_NAMES: Record<string, string> = {
  remotive: "Remotive",
  remoteok: "Remote OK",
  weworkremotely: "We Work Remotely",
  jobicy: "Jobicy",
  himalayas: "Himalayas",
  pasted: "Pasted post",
};

export function sourceName(source: string): string {
  return SOURCE_NAMES[source] ?? source;
}
