import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadFeedItem } from "@/lib/feed";
import { loadLatestKit } from "@/lib/kit";
import { checkKit } from "@/lib/kit-checks";
import { loadProfileBundle, missingProfileDetails } from "@/lib/profile";
import { BuildKitButton } from "@/components/kit/BuildKitButton";
import { KitEditor } from "@/components/kit/KitEditor";
import { JobActions } from "@/components/feed/JobActions";
import { NgChip, ScamChip, ScoreBadge } from "@/components/feed/JobChips";
import { Chip } from "@/components/Chip";
import { sourceName } from "@/lib/util";
import { BackIcon, HeartMark } from "@/components/Icons";
import { ngEvidence } from "@/lib/feed";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function KitPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [item, kit, bundle] = await Promise.all([
    loadFeedItem(supabase, user.id, params.id),
    loadLatestKit(supabase, user.id, params.id),
    loadProfileBundle(supabase, user.id),
  ]);
  if (!item) notFound();
  const { job, match, application } = item;

  const missing = missingProfileDetails(bundle);
  const unconfirmed = bundle.experiences.filter((e) => !e.verified);
  const checks = kit ? checkKit(kit, bundle, `${job.title}\n${job.description}\n${job.salary_text ?? ""}`) : null;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Link href={`/?job=${job.id}`} className="btn-secondary">
        <BackIcon className="h-5 w-5" />
        Back to job
      </Link>

      <header className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <ScoreBadge score={match?.score ?? null} size="lg" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-rose-strong">Application kit</p>
          <h1 className="break-words text-[1.75rem] leading-tight sm:text-[2.25rem]">{job.title}</h1>
          <p className="text-muted">{job.company || "Company not named"}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <NgChip eligible={job.ng_eligible} reason={job.ng_reason} evidence={ngEvidence(job)} />
            <ScamChip level={job.scam_level} />
            {application && <Chip tone="info">{application.stage}</Chip>}
          </div>
        </div>
      </header>

      {job.ng_eligible === false && (
        <p role="alert" className="rounded-2xl bg-[var(--bad-bg)] p-4 font-semibold text-[var(--bad-fg)]">
          ✕ This job is not open to applicants in Nigeria ({job.ng_reason}). It no longer appears in your feed.
        </p>
      )}
      {job.ng_eligible === null && (
        <p role="alert" className="rounded-2xl bg-[var(--warn-bg)] p-4 font-semibold text-[var(--warn-fg)]">
          ! Location not stated. Check the original post allows Nigeria before applying.
        </p>
      )}

      {job.scam_level === "high" && (
        <p role="alert" className="rounded-2xl bg-[var(--bad-bg)] p-4 font-semibold text-[var(--bad-fg)]">
          ✕ This post shows strong scam signs. Read the warnings on the job page before you spend time on it.
        </p>
      )}

      <section className="card space-y-4 p-5">
        <p>
          <strong>You stay in control.</strong> This desk never applies for you. Check and edit everything below, then apply
          on the company&apos;s own site and tap &quot;I submitted it: mark as applied&quot;.
        </p>
        <JobActions jobId={job.id} jobUrl={job.url} sourceLabel={sourceName(job.source)} stage={application?.stage ?? null} hasKit showKitLink={false} />
      </section>

      {(missing.length > 0 || unconfirmed.length > 0) && (
        <section className="card p-5">
          <h2 className="text-xl">About your profile</h2>
          <ul className="mt-2 space-y-2">
            {missing.length > 0 && (
              <li>
                <Chip tone="warn">Missing</Chip> {missing.join(", ")}. These show as [placeholders].{" "}
                <Link href="/profile" className="link">
                  Update profile
                </Link>
              </li>
            )}
            {unconfirmed.length > 0 && (
              <li>
                <Chip tone="warn">Needs confirmation</Chip> Left out of this kit: {unconfirmed.map((e) => e.employer).join(", ")}.
              </li>
            )}
          </ul>
        </section>
      )}

      {!kit && job.ng_eligible === false ? null : !kit ? (
        <section className="card flex flex-col items-start gap-3 p-6">
          <HeartMark className="h-8 w-8 text-rose" />
          <h2 className="text-2xl">Let&apos;s build your kit</h2>
          <p className="text-muted">
            You&apos;ll get a tailored CV, a cover letter and answers to common questions, written only from your saved profile.
            You can edit everything before you send it.
          </p>
          <div className="mt-1 w-full sm:w-auto">
            <BuildKitButton jobId={job.id} />
          </div>
        </section>
      ) : (
        <>
          {checks && (checks.unknownNumbers.length > 0 || checks.unconfirmedMentions.length > 0 || checks.unsupportedClaims.length > 0) && (
            <section aria-labelledby="fact-heading" className="rounded-2xl bg-[var(--bad-bg)] p-5 text-[var(--bad-fg)]">
              <h2 id="fact-heading" className="text-xl">
                ✕ Check these facts
              </h2>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {checks.unknownNumbers.length > 0 && (
                  <li>
                    These numbers are not in your profile or the job post: <strong>{checks.unknownNumbers.join(", ")}</strong>. Remove
                    them or make sure they are true.
                  </li>
                )}
                {checks.unconfirmedMentions.length > 0 && (
                  <li>
                    Mentions a role you have not confirmed: <strong>{checks.unconfirmedMentions.join(", ")}</strong>. Confirm it on
                    the Profile page or remove it.
                  </li>
                )}
                {checks.unsupportedClaims.length > 0 && (
                  <li>
                    These sentences claim things your profile does not say. Make them true for you, or delete them:
                    <ul className="mt-1 list-none space-y-1 pl-0">
                      {checks.unsupportedClaims.map((c) => (
                        <li key={c} className="break-words">
                          ! {c}
                        </li>
                      ))}
                    </ul>
                  </li>
                )}
              </ul>
            </section>
          )}
          <KitEditor key={kit.id} kit={kit} jobId={job.id} />
          <div className="pt-2">
            <BuildKitButton jobId={job.id} rebuild />
          </div>
        </>
      )}
    </div>
  );
}
