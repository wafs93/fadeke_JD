import Link from "next/link";
import { Chip } from "@/components/Chip";
import { JobActions } from "@/components/feed/JobActions";
import { NgChip, ScamChip, ScoreBadge } from "@/components/feed/JobChips";
import { BackIcon } from "@/components/Icons";
import { ngEvidence, type FeedItem } from "@/lib/feed";
import { formatPostedAgo, sourceName } from "@/lib/util";

export function JobDetail({ item, hasKit, backHref }: { item: FeedItem; hasKit: boolean; backHref?: string }) {
  const { job, match, application } = item;
  const source = sourceName(job.source);

  return (
    <div className="space-y-3">
      {backHref && (
        <div className="sticky top-0 z-20 -mx-4 bg-surface/95 px-4 py-2 backdrop-blur lg:hidden">
          <Link href={backHref} className="btn-secondary">
            <BackIcon className="h-5 w-5" />
            Back to jobs
          </Link>
        </div>
      )}

      <article aria-labelledby="job-title" className="card p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <ScoreBadge score={match?.score ?? null} size="lg" />
          <div className="min-w-0">
            <h2 id="job-title" className="break-words text-[1.75rem] leading-tight">
              {job.title}
            </h2>
            <p className="mt-1 text-muted">
              {job.company || "Company not named"} · {formatPostedAgo(job.posted_at)}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <NgChip eligible={job.ng_eligible} reason={job.ng_reason} evidence={ngEvidence(job)} />
              <ScamChip level={job.scam_level} score={job.scam_score} />
              <Chip tone="neutral" symbol={null}>
                From {source}
              </Chip>
              {job.owner_id && (
                <Chip tone="info" symbol={null}>
                  Added by you
                </Chip>
              )}
              {application && <Chip tone="info">{application.stage}</Chip>}
            </div>
          </div>
        </div>

        <dl className="mt-5 grid gap-3 rounded-2xl bg-sunken p-4 sm:grid-cols-2">
          <div>
            <dt className="font-semibold">Location rules</dt>
            <dd className="break-words text-muted">{job.region_text || "Not stated"}</dd>
          </div>
          <div>
            <dt className="font-semibold">Pay</dt>
            <dd className="text-muted">{job.salary_text || "Not stated"}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="font-semibold">Can you apply from Nigeria?</dt>
            <dd className="break-words text-muted">
              {job.ng_eligible === true ? "Yes. " : job.ng_eligible === false ? "No. " : "Not stated. "}
              {job.ng_reason || "Not checked"}
              {job.ng_method === "ai" && " (checked by AI reading the post; the quote is copied from it)"}
            </dd>
          </div>
        </dl>

        <div className="mt-5">
          <JobActions
            jobId={job.id}
            jobUrl={job.url}
            sourceLabel={source}
            linkLabel={job.owner_id ? "Open your link" : undefined}
            stage={application?.stage ?? null}
            hasKit={hasKit}
          />
          <p className="mt-3 text-sm text-muted">
            This desk never applies for you. Build the kit, check it, then apply on the company&apos;s own site.
          </p>
        </div>

        {job.scam_flags.length > 0 && (
          <section aria-labelledby="scam-heading" className="mt-6 rounded-2xl bg-[var(--warn-bg)] p-4 text-[var(--warn-fg)]">
            <h3 id="scam-heading">! Scam signs found</h3>
            <ul className="mt-2 space-y-2">
              {job.scam_flags.map((f) => (
                <li key={f.id}>
                  <span className="font-semibold">{f.label}</span>
                  {f.evidence && <span className="block break-words">&ldquo;{f.evidence}&rdquo;</span>}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-sm">Never pay to get a job, and never share bank details, BVN or NIN before a real offer.</p>
          </section>
        )}

        {match && (
          <section aria-labelledby="fit-heading" className="mt-6 space-y-4">
            <h3 id="fit-heading" className="font-display text-2xl">
              How you fit
            </h3>
            {match.reasons.length > 0 && (
              <ul className="list-disc space-y-1 pl-5">
                {match.reasons.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl bg-[var(--good-bg)] p-4 text-[var(--good-fg)]">
                <h4>✓ What you have</h4>
                <ul className="mt-1 space-y-1">
                  {match.have.length ? match.have.map((h, i) => <li key={i}>{h}</li>) : <li>Nothing clear yet</li>}
                </ul>
              </div>
              <div className="rounded-2xl bg-[var(--warn-bg)] p-4 text-[var(--warn-fg)]">
                <h4>! Gaps</h4>
                <ul className="mt-1 space-y-1">
                  {match.gaps.length ? match.gaps.map((g, i) => <li key={i}>{g}</li>) : <li>No gaps found</li>}
                </ul>
              </div>
            </div>
          </section>
        )}

        <section aria-labelledby="desc-heading" className="mt-6">
          <h3 id="desc-heading" className="font-display text-2xl">
            Job description
          </h3>
          <div className="mt-2 max-h-[60dvh] overflow-y-auto whitespace-pre-wrap break-words rounded-2xl bg-sunken p-4 leading-relaxed">
            {job.description || "No description given."}
          </div>
          <p className="mt-2 text-sm text-muted">
            {job.owner_id ? (
              <>You added this post from {source}.</>
            ) : (
              <>
                Listing from{" "}
                <a href={job.url} target="_blank" rel="noopener noreferrer" className="link">
                  {source}
                </a>
                .
              </>
            )}{" "}
            Always read the original post before applying.
          </p>
        </section>
      </article>
    </div>
  );
}
