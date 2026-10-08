"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { buildKit } from "@/app/jobs/[id]/kit/actions";

export function BuildKitButton({ jobId, rebuild = false }: { jobId: string; rebuild?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onClick() {
    if (rebuild && !window.confirm("Write a fresh kit? Your edits stay in the old version, but this page will show the new one.")) return;
    setError(null);
    startTransition(async () => {
      const res = await buildKit(jobId);
      if (!res.ok) setError(res.error);
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <button type="button" className={`${rebuild ? "btn-secondary" : "btn-primary"} w-full sm:w-auto`} disabled={pending} onClick={onClick}>
        {pending ? "Writing your kit…" : rebuild ? "Rebuild kit" : "Build application kit"}
      </button>
      {pending && (
        <p role="status" aria-live="polite" className="text-sm text-muted">
          This takes about 20 seconds.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm font-semibold text-[var(--bad-fg)]">
          ✕ {error}
        </p>
      )}
    </div>
  );
}
