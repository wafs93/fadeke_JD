"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markApplied, saveToTracker } from "@/app/jobs/actions";
import type { Stage } from "@/lib/types";

export function JobActions({
  jobId,
  jobUrl,
  sourceLabel,
  stage,
  hasKit,
}: {
  jobId: string;
  jobUrl: string;
  sourceLabel: string;
  stage: Stage | null;
  hasKit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Something went wrong");
      router.refresh();
    });
  }

  const applied = stage !== null && stage !== "Saved";

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Link href={`/jobs/${jobId}/kit`} className="btn-primary">
          {hasKit ? "Open application kit" : "Build application kit"}
        </Link>
        <a href={jobUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary">
          View on {sourceLabel} <span aria-hidden="true">↗</span>
          <span className="sr-only">(opens in a new tab)</span>
        </a>
        {stage === null && (
          <button type="button" className="btn-secondary" disabled={pending} onClick={() => run(() => saveToTracker(jobId))}>
            Save to tracker
          </button>
        )}
        {!applied && (
          <button type="button" className="btn-secondary" disabled={pending} onClick={() => run(() => markApplied(jobId))}>
            Mark as applied
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm font-semibold text-[var(--bad-fg)]">
          ✕ {error}
        </p>
      )}
    </div>
  );
}
