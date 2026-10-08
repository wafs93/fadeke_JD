import Link from "next/link";
import { Chip } from "@/components/Chip";
import { JobActions } from "@/components/feed/JobActions";
import { NgChip, ScamChip, ScoreBadge } from "@/components/feed/JobChips";
import type { FeedItem } from "@/lib/feed";
import { formatPostedAgo, sourceName } from "@/lib/util";

export function JobDetail({ item, hasKit, backHref }: { item: FeedItem; hasKit: boolean; backHref?: string }) {
  const { job, match, application } = item;
  const source = sourceName(job.source);

  return (
    <article aria-labelledby="job-title" className="card p-4 sm:p-6">
      {backHref && (
        <Link href={backHref} className="mb-3 inline-block text-sm font-semibold underline lg:hidden">
          ← Back to list
        </Link>
      )}

      <div className="flex items-start gap-4">
        <ScoreBadge score={match?.score ?? null} size="lg" />
        <div className="min-w-0">
          <h2 id="job-title" className="text-2xl font-extrabold leading-tight">
            {job.title}
          </h2>
          <p className="mt-1 text-muted">
            {job.company || "Company not named"} · {formatPostedAgo(job.posted_at)}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <NgChip eligible={job.ng_eligible} reason={job.ng_reason} />
            <ScamChip level={job.scam_level} score={job.scam_score} />
            <Chip tone="neutral" symbol={null}>
              Source: {source}
            </Chip>
            {application && <Chip tone="info">{application.stage}</Chip>}
          </div>
        </div>
      </div>

      <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="font-semibold">Location rules</dt>
          <dd className="text-muted">{job.region_text || "Not stated"}</dd>
        </div>
        <div>
          <dt className="font-semibold">Pay</dt>
          <dd className="text-muted">{job.salary_text || "Not stated"}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="font-semibold">Can you apply from Nigeria?</dt>
          <dd className="text-muted">{job.ng_reason || "Not checked"}</dd>
        </div>
      </dl>

      <div className="mt-5">
        <JobActions
          jobId={job.id}
          jobUrl={job.url}
          sourceLabel={source}
          stage={application?.stage ?? null}
          hasKit={hasKit}
        />
        <p className="mt-2 text-xs text-muted">
          This desk never applies for you. Build the kit, check it, then apply on the company&apos;s own site.
        </p>
      </div>

      {job.scam_flags.length > 0 && (
        <section aria-labelledby="scam-heading" className="mt-6 rounded-lg border-2 border-[var(--warn-fg)] p-3">
          <h3 id="scam-heading" className="font-bold">
            Scam signs found
          </h3>
          <ul className="mt-2 space-y-2 text-sm">
            {job.scam_flags.map((f) => (
              <li key={f.id}>
                <span className="font-semibold">! {f.label}</span>
                {f.evidence && <span className="block text-muted">&ldquo;{f.evidence}&rdquo;</span>}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">
            Never pay to get a job, and never share bank details, BVN or NIN before a real offer.
          </p>
        </section>
      )}

      {match && (
        <section aria-labelledby="fit-heading" className="mt-6 space-y-4">
          <h3 id="fit-heading" className="text-lg font-bold">
            How you fit
          </h3>
          {match.reasons.length > 0 && (
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {match.reasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <h4 className="font-semibold">✓ What you have</h4>
              <ul className="mt-1 space-y-1 text-sm">
                {match.have.length ? match.have.map((h, i) => <li key={i}>✓ {h}</li>) : <li className="text-muted">Nothing clear yet</li>}
              </ul>
            </div>
            <div>
              <h4 className="font-semibold">! Gaps</h4>
              <ul className="mt-1 space-y-1 text-sm">
                {match.gaps.length ? match.gaps.map((g, i) => <li key={i}>! {g}</li>) : <li className="text-muted">No gaps found</li>}
              </ul>
            </div>
          </div>
        </section>
      )}

      <section aria-labelledby="desc-heading" className="mt-6">
        <h3 id="desc-heading" className="text-lg font-bold">
          Job description
        </h3>
        <div className="mt-2 max-h-[60vh] overflow-y-auto whitespace-pre-wrap rounded-lg bg-[var(--bg-sunken)] p-3 text-sm leading-relaxed">
          {job.description || "No description given."}
        </div>
        <p className="mt-2 text-xs text-muted">
          Listing from{" "}
          <a href={job.url} target="_blank" rel="noopener noreferrer" className="underline">
            {source}
          </a>
          . Always read the original post before applying.
        </p>
      </section>
    </article>
  );
}
