"use client";

import Link from "next/link";
import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markApplied, saveToTracker } from "@/app/jobs/actions";
import { Celebrate } from "@/components/Celebrate";
import { ExternalIcon } from "@/components/Icons";
import type { Stage } from "@/lib/types";

export function JobActions({
  jobId,
  jobUrl,
  sourceLabel,
  stage,
  hasKit,
  showKitLink = true,
  linkLabel,
}: {
  jobId: string;
  jobUrl: string;
  sourceLabel: string;
  stage: Stage | null;
  hasKit: boolean;
  /** False on the kit page itself. */
  showKitLink?: boolean;
  /** Overrides "View on {source}", e.g. "Open your link" for pasted posts. */
  linkLabel?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState(false);
  const [justApplied, setJustApplied] = useState(false);
  const stopCelebrating = useCallback(() => setCelebrate(false), []);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, onOk?: () => void) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Something went wrong");
      else onOk?.();
      router.refresh();
    });
  }

  const applied = justApplied || (stage !== null && stage !== "Saved");

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {showKitLink && (
          <Link href={`/jobs/${jobId}/kit`} className="btn-primary w-full sm:w-auto">
            {hasKit ? "Open application kit" : "Build application kit"}
          </Link>
        )}
        {jobUrl && (
          <a href={jobUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary w-full sm:w-auto">
            {linkLabel ?? `View on ${sourceLabel}`}
            <ExternalIcon className="h-4 w-4" />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        )}
        {stage === null && !justApplied && (
          <button
            type="button"
            className="btn-secondary w-full sm:w-auto"
            disabled={pending}
            onClick={() => run(() => saveToTracker(jobId))}
          >
            Save to tracker
          </button>
        )}
        {!applied && (
          <button
            type="button"
            className="btn-secondary w-full sm:w-auto"
            disabled={pending}
            onClick={() =>
              run(
                () => markApplied(jobId),
                () => {
                  setJustApplied(true);
                  setCelebrate(true);
                }
              )
            }
          >
            I submitted it: mark as applied
          </button>
        )}
      </div>

      <p role="status" aria-live="polite" className={justApplied ? "font-semibold text-[var(--good-fg)]" : "sr-only"}>
        {justApplied ? "✓ Marked as applied. Well done! A follow-up reminder is set for one week." : ""}
      </p>
      {error && (
        <p role="alert" className="font-semibold text-[var(--bad-fg)]">
          ✕ {error}
        </p>
      )}
      <Celebrate show={celebrate} onDone={stopCelebrating} />
    </div>
  );
}
