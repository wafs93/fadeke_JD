import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { countUnclear, loadFeed, ngEvidence, sortFeed, type FeedSort } from "@/lib/feed";
import { RunButtons } from "@/components/feed/RunButtons";
import { JobDetail } from "@/components/feed/JobDetail";
import { NgChip, ScamChip, ScoreBadge } from "@/components/feed/JobChips";
import { Chip } from "@/components/Chip";
import { formatPostedAgo, sourceName } from "@/lib/util";

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
  const pill = (active: boolean) =>
    `rounded-full border px-3 py-1.5 ${active ? "border-ink bg-ink text-surface" : "border-line"}`;

  return (
    <div className="space-y-4">
      <div className={`flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between ${selected ? "hidden lg:flex" : ""}`}>
        <div>
          <h1 className="text-3xl font-extrabold">Job feed</h1>
          <p className="mt-1 text-sm text-muted">
            Only remote assistant roles that say they are open to applicants in Nigeria, ranked against your profile.
          </p>
        </div>
        <RunButtons />
      </div>

      <div className={`flex flex-wrap items-center gap-2 text-sm ${selected ? "hidden lg:flex" : ""}`}>
        <span className="font-semibold">Sort:</span>
        <Link href={href({ ...base, sort: "score" })} aria-current={sort === "score" ? "true" : undefined} className={pill(sort === "score")}>
          Best match
        </Link>
        <Link href={href({ ...base, sort: "newest" })} aria-current={sort === "newest" ? "true" : undefined} className={pill(sort === "newest")}>
          Newest
        </Link>
        <span className="mx-1 hidden h-5 w-px bg-line sm:inline-block" aria-hidden="true" />
        <Link
          href={href({ ...base, check: showUnclear ? undefined : "1" })}
          role="switch"
          aria-checked={showUnclear}
          className={`inline-flex items-center gap-2 ${pill(showUnclear)}`}
        >
          <span aria-hidden="true">{showUnclear ? "☑" : "☐"}</span>
          Show jobs that need checking ({unclearCount})
        </Link>
      </div>

      {showUnclear && (
        <p className={`rounded-lg border-2 border-[var(--warn-fg)] bg-[var(--warn-bg)] px-3 py-2 text-sm text-[var(--warn-fg)] ${selected ? "hidden lg:block" : ""}`}>
          ! Jobs marked &quot;Location not stated&quot; did not say who can apply. Read the original post and make sure Nigeria is
          allowed before you spend time on them.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <section aria-label="Jobs" className={selected ? "hidden lg:block" : ""}>
          {items.length === 0 ? (
            <div className="card p-6 text-sm">
              <p className="font-semibold">No jobs open to Nigeria yet.</p>
              <p className="mt-1 text-muted">
                Press &quot;Fetch new jobs&quot;, then &quot;Score new jobs&quot;. New jobs also arrive on their own several times a day.
              </p>
            </div>
          ) : (
            <ol className="space-y-2 lg:max-h-[calc(100vh-220px)] lg:overflow-y-auto lg:pr-1">
              {items.map(({ job, match, application }) => {
                const active = selected?.job.id === job.id;
                return (
                  <li key={job.id}>
                    <Link
                      href={href({ ...base, job: job.id })}
                      aria-current={active ? "true" : undefined}
                      className={`card flex gap-3 p-3 hover:border-ink ${active ? "border-2 border-ink" : ""}`}
                    >
                      <ScoreBadge score={match?.score ?? null} />
                      <div className="min-w-0 flex-1">
                        <p className="font-bold leading-snug">{job.title}</p>
                        <p className="truncate text-sm text-muted">
                          {job.company || "Company not named"} · {sourceName(job.source)} · {formatPostedAgo(job.posted_at)}
                        </p>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          <NgChip eligible={job.ng_eligible} reason={job.ng_reason} evidence={ngEvidence(job)} />
                          {job.scam_level !== "low" && <ScamChip level={job.scam_level} />}
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
            <div className="card hidden p-6 text-sm text-muted lg:block">Pick a job on the left to see the details.</div>
          )}
        </section>
      </div>
    </div>
  );
}
