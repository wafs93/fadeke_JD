import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { countUnclear, loadFeed, ngEvidence, sortFeed, type FeedSort } from "@/lib/feed";
import { RunButtons } from "@/components/feed/RunButtons";
import { JobDetail } from "@/components/feed/JobDetail";
import { NgChip, ScamChip, ScoreBadge } from "@/components/feed/JobChips";
import { Chip } from "@/components/Chip";
import { FilterIcon, HeartMark } from "@/components/Icons";
import { lagosPartOfDay, OWNER_FIRST_NAME } from "@/lib/brand";
import { formatPostedAgo, sourceName, todayInLagos } from "@/lib/util";

export const dynamic = "force-dynamic";

type Search = { job?: string; sort?: string; check?: string };

function href(params: Search): string {
  const qs = new URLSearchParams();
  if (params.sort && params.sort !== "score") qs.set("sort", params.sort);
  if (params.check === "1") qs.set("check", "1");
  if (params.job) qs.set("job", params.job);
  const s = qs.toString();
  return s ? `/?${s}` : "/";
}

function lagosDate(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(new Date(iso));
}

function Filters({ base, sort, showUnclear, unclearCount }: { base: Search; sort: FeedSort; showUnclear: boolean; unclearCount: number }) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
      <div role="group" aria-label="Sort jobs" className="scroll-row">
        <Link href={href({ ...base, sort: "score" })} aria-current={sort === "score" ? "true" : undefined} className="pill">
          Best match
        </Link>
        <Link href={href({ ...base, sort: "newest" })} aria-current={sort === "newest" ? "true" : undefined} className="pill">
          Newest
        </Link>
      </div>
      <Link
        href={href({ ...base, check: showUnclear ? undefined : "1" })}
        role="switch"
        aria-checked={showUnclear}
        className="pill self-start"
      >
        <span
          aria-hidden="true"
          className={`relative inline-block h-5 w-9 rounded-full transition-colors ${showUnclear ? "bg-[var(--on-primary)]/30" : "bg-tint"}`}
        >
          <span
            className={`absolute top-0.5 h-4 w-4 rounded-full ${showUnclear ? "left-[18px] bg-[var(--on-primary)]" : "left-0.5 bg-rose"}`}
          />
        </span>
        Show jobs that need checking ({unclearCount})
      </Link>
    </div>
  );
}

export default async function FeedPage({ searchParams }: { searchParams: Search }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const sort: FeedSort = searchParams.sort === "newest" ? "newest" : "score";
  const showUnclear = searchParams.check === "1";

  const [loaded, unclearCount] = await Promise.all([loadFeed(supabase, user.id, showUnclear), countUnclear(supabase)]);
  const items = sortFeed(loaded, sort);
  const selected = searchParams.job ? loaded.find((i) => i.job.id === searchParams.job) ?? null : null;

  const today = todayInLagos();
  const openJobs = loaded.filter((i) => i.job.ng_eligible === true);
  const newToday = openJobs.filter((i) => i.job.posted_at && lagosDate(i.job.posted_at) === today).length;

  let hasKit = false;
  if (selected) {
    const { count } = await supabase
      .from("kits")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("job_id", selected.job.id);
    hasKit = (count ?? 0) > 0;
  }

  const base: Search = { sort, check: showUnclear ? "1" : undefined };
  const summary =
    openJobs.length === 0
      ? "No open jobs just yet, so let's go and find some."
      : `${openJobs.length} ${openJobs.length === 1 ? "job is" : "jobs are"} open to you${
          newToday ? `, and ${newToday} ${newToday === 1 ? "is" : "are"} new today` : ""
        }.`;

  return (
    <div className="space-y-5">
      {/* On phones the list is the first screen; a selected job replaces it. */}
      <div className={selected ? "hidden space-y-5 lg:block" : "space-y-5"}>
        <section aria-labelledby="greeting" className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 id="greeting" className="text-[2rem] leading-tight sm:text-[2.5rem]">
              Good {lagosPartOfDay()}, {OWNER_FIRST_NAME}
            </h1>
            <p className="mt-1 text-muted">{summary}</p>
          </div>
          <RunButtons />
        </section>

        {/* Filters: an expandable row on phones, inline on desktop. */}
        <details className="card group px-4 py-1 lg:hidden">
          <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between font-semibold">
            <span className="flex items-center gap-2">
              <FilterIcon className="h-5 w-5" /> Filters
            </span>
            <span className="text-sm text-muted">
              {sort === "score" ? "Best match" : "Newest"}
              {showUnclear ? " · incl. need checking" : ""}
            </span>
          </summary>
          <div className="pb-3 pt-2">
            <Filters base={base} sort={sort} showUnclear={showUnclear} unclearCount={unclearCount} />
          </div>
        </details>
        <div className="hidden lg:block">
          <Filters base={base} sort={sort} showUnclear={showUnclear} unclearCount={unclearCount} />
        </div>

        {showUnclear && (
          <p className="rounded-2xl bg-[var(--warn-bg)] px-4 py-3 text-[var(--warn-fg)]">
            <strong>! Need checking:</strong> these posts didn&apos;t say who can apply. Read the original post and make sure
            Nigeria is allowed before you spend time on one.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <section aria-label="Jobs" className={selected ? "hidden lg:block" : ""}>
          {items.length === 0 ? (
            <div className="card flex flex-col items-start gap-3 p-6">
              <HeartMark className="h-8 w-8 text-rose" />
              <h2 className="text-2xl">Your next role is out there</h2>
              <p className="text-muted">
                Tap &quot;Fetch new jobs&quot; to look now. New jobs also arrive on their own a few times a day, and only ones open
                to applicants in Nigeria appear here.
              </p>
              {!showUnclear && unclearCount > 0 && (
                <Link href={href({ ...base, check: "1" })} className="link">
                  Look at {unclearCount} {unclearCount === 1 ? "job" : "jobs"} that need checking
                </Link>
              )}
            </div>
          ) : (
            <ol className="space-y-3 lg:max-h-[calc(100dvh-260px)] lg:overflow-y-auto lg:pr-1">
              {items.map(({ job, match, application }) => {
                const active = selected?.job.id === job.id;
                return (
                  <li key={job.id}>
                    <Link
                      href={href({ ...base, job: job.id })}
                      aria-current={active ? "true" : undefined}
                      className={`card flex gap-3 p-4 transition-colors hover:border-[var(--primary)] ${
                        active ? "border-[var(--primary)] bg-tint [--ring-track:var(--bg-elevated)]" : ""
                      }`}
                    >
                      <ScoreBadge score={match?.score ?? null} />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold leading-snug text-ink">{job.title}</p>
                        <p className="mt-0.5 truncate text-sm text-muted">
                          {job.company || "Company not named"} · {sourceName(job.source)}
                        </p>
                        <p className="text-sm text-muted">{formatPostedAgo(job.posted_at)}</p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <NgChip eligible={job.ng_eligible} reason={job.ng_reason} evidence={ngEvidence(job)} />
                          <ScamChip level={job.scam_level} />
                          {application && <Chip tone="info">{application.stage}</Chip>}
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <section aria-label="Job details" className={selected ? "" : "hidden lg:block"}>
          {selected ? (
            <JobDetail item={selected} hasKit={hasKit} backHref={href({ ...base, job: undefined })} />
          ) : (
            <div className="card hidden flex-col items-start gap-2 p-6 lg:flex">
              <HeartMark className="h-7 w-7 text-rose" />
              <h2 className="text-2xl">Pick a job to see the details</h2>
              <p className="text-muted">You&apos;ll see how you fit, any scam signs, and a button to build your application kit.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
