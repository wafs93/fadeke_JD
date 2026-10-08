"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { addJob } from "@/app/jobs/add/actions";
import type { PasteResult } from "@/lib/paste";
import { PASTE_SOURCES, PASTE_SOURCE_LABELS } from "@/lib/paste-input";
import { NgChip, ScamChip, ScoreBadge } from "@/components/feed/JobChips";
import { Chip } from "@/components/Chip";

function ResultCard({ r, onAnother }: { r: PasteResult; onAnother: () => void }) {
  const closed = r.eligible === false;
  const risky = r.scamLevel === "high";
  const blocked = closed || risky;

  return (
    <section aria-live="polite" aria-labelledby="result-heading" className="card space-y-5 p-5 sm:p-6">
      {r.duplicate && (
        <p className="rounded-2xl bg-[var(--info-bg)] px-4 py-3 text-[var(--info-fg)]">
          i You already added this post, so here is the earlier result. Nothing new was saved.
        </p>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <ScoreBadge score={r.score} size="lg" />
        <div className="min-w-0">
          <h2 id="result-heading" className="break-words text-[1.75rem] leading-tight">
            {r.title}
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <Chip tone="info" symbol={null}>
              Added by you
            </Chip>
            <NgChip eligible={r.eligible} reason={r.ngReason} evidence={r.ngEvidence} />
            <ScamChip level={r.scamLevel} score={r.scamScore} />
          </div>
        </div>
      </div>

      {closed && (
        <p className="rounded-2xl bg-[var(--bad-bg)] p-4 text-[var(--bad-fg)]">
          <strong>✕ You can&apos;t apply for this one from Nigeria.</strong> {r.ngReason}. It won&apos;t appear in your feed.
        </p>
      )}
      {!closed && risky && (
        <div className="rounded-2xl bg-[var(--bad-bg)] p-4 text-[var(--bad-fg)]">
          <p>
            <strong>✕ This post looks like a scam.</strong> Don&apos;t send money, bank details, BVN or NIN.
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {r.scamFlags.map((f) => (
              <li key={f.id}>
                {f.label}
                {f.evidence && <span className="block break-words">&ldquo;{f.evidence}&rdquo;</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {r.eligible === null && !risky && (
        <p className="rounded-2xl bg-[var(--warn-bg)] p-4 text-[var(--warn-fg)]">
          <strong>! The post doesn&apos;t say who can apply.</strong> Check that Nigeria is allowed before you spend time on it.
          It&apos;s listed under &quot;Show jobs that need checking&quot;.
        </p>
      )}
      {r.eligible === true && !risky && (
        <p className="rounded-2xl bg-[var(--good-bg)] p-4 text-[var(--good-fg)]">
          <strong>✓ You can apply from Nigeria.</strong>{" "}
          {r.ngEvidence ? <>The post says &ldquo;{r.ngEvidence}&rdquo;.</> : r.ngReason}
          {r.ngMethod === "ai" && " (Found by AI reading the post; the quote is copied from it.)"}
        </p>
      )}
      {!risky && r.scamLevel === "medium" && (
        <div className="rounded-2xl bg-[var(--warn-bg)] p-4 text-[var(--warn-fg)]">
          <p>
            <strong>! Some scam signs.</strong> Check the company before you apply.
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {r.scamFlags.map((f) => (
              <li key={f.id}>{f.label}</li>
            ))}
          </ul>
        </div>
      )}

      {r.score !== null ? (
        <div className="space-y-3">
          <h3 className="font-display text-2xl">How you fit</h3>
          <ul className="list-disc space-y-1 pl-5">
            {r.reasons.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
          {r.gaps.length > 0 && (
            <p className="text-muted">
              <span className="font-semibold">Gaps:</span> {r.gaps.join("; ")}
            </p>
          )}
        </div>
      ) : (
        r.scoreNote && <p className="text-muted">{r.scoreNote}</p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {!blocked && (
          <Link href={`/jobs/${r.jobId}/kit`} className="btn-primary w-full sm:w-auto">
            Build application kit
          </Link>
        )}
        {r.eligible === true && !risky && (
          <Link href={`/?job=${r.jobId}`} className="btn-secondary w-full sm:w-auto">
            See it in your feed
          </Link>
        )}
        <button type="button" className="btn-secondary w-full sm:w-auto" onClick={onAnother}>
          Add another job
        </button>
      </div>
    </section>
  );
}

export function AddJobForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PasteResult | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      const res = await addJob(data);
      if (res.ok) {
        setResult(res.result);
        window.scrollTo({ top: 0 });
      } else setError(res.error);
    });
  }

  if (result) {
    return (
      <ResultCard
        r={result}
        onAnother={() => {
          setResult(null);
          formRef.current?.reset();
        }}
      />
    );
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="card space-y-5 p-5 sm:p-6">
      <div>
        <label htmlFor="text" className="label">
          Paste the job post
        </label>
        <textarea
          id="text"
          name="text"
          required
          rows={12}
          className="input"
          placeholder="Copy the whole post from LinkedIn, X, WhatsApp or an email and paste it here."
          aria-describedby="text-hint"
        />
        <p id="text-hint" className="hint">
          Include the location and how to apply, so it can be checked properly.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <label htmlFor="source" className="label">
            Where did you find it?
          </label>
          <select id="source" name="source" className="input" defaultValue="linkedin">
            {PASTE_SOURCES.map((s) => (
              <option key={s} value={s}>
                {PASTE_SOURCE_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="company" className="label">
            Company name <span className="font-normal text-muted">(optional)</span>
          </label>
          <input id="company" name="company" className="input" autoComplete="organization" />
        </div>
        <div className="md:col-span-2">
          <label htmlFor="link" className="label">
            Link to the post <span className="font-normal text-muted">(optional)</span>
          </label>
          <input
            id="link"
            name="link"
            type="url"
            inputMode="url"
            className="input"
            placeholder="https://"
            aria-describedby="link-hint"
          />
          <p id="link-hint" className="hint">
            Saved for you to open later. The desk never visits it.
          </p>
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-2xl bg-[var(--bad-bg)] px-4 py-3 text-[var(--bad-fg)]">
          ✕ {error}
        </p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <button type="submit" className="btn-primary w-full sm:w-auto" disabled={pending}>
          {pending ? "Checking…" : "Check this job"}
        </button>
        {pending && (
          <p role="status" aria-live="polite" className="text-sm text-muted">
            Checking location, scam signs and your fit. This can take up to 30 seconds.
          </p>
        )}
      </div>
    </form>
  );
}
