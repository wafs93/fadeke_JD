"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sourceName } from "@/lib/util";

interface AiSummary {
  checked: number;
  open: number;
  closed: number;
  unclear: number;
  skipped?: string;
}

interface FetchResult {
  sources?: { source: string; status: string; kept: number; message?: string }[];
  ai?: AiSummary;
  error?: string;
}

function aiLine(ai?: AiSummary): string | null {
  if (!ai) return null;
  if (ai.skipped) return `• Location check skipped: ${ai.skipped}`;
  if (!ai.checked) return null;
  return `✓ Read ${ai.checked} posts with no clear location: ${ai.open} open, ${ai.closed} closed, ${ai.unclear} still unclear`;
}

interface MatchResult {
  ai?: AiSummary;
  scored?: number;
  remaining?: number;
  errors?: string[];
  error?: string;
}

export function RunButtons() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<"fetch" | "match" | null>(null);
  const [lines, setLines] = useState<string[]>([]);

  async function post<T>(path: string): Promise<T> {
    const res = await fetch(path, { method: "POST" });
    const body = (await res.json().catch(() => ({ error: `HTTP ${res.status}` }))) as T;
    return body;
  }

  function runFetch() {
    setBusy("fetch");
    setLines(["Fetching from public job feeds…"]);
    startTransition(async () => {
      const r = await post<FetchResult>("/api/run/fetch");
      if (r.error) setLines([`✕ ${r.error}`]);
      else
        setLines(
          [...(r.sources ?? []).map((s) =>
            s.status === "ok"
              ? `✓ ${sourceName(s.source)}: ${s.kept} matching jobs`
              : s.status === "skipped"
                ? `• ${sourceName(s.source)}: skipped. ${s.message ?? ""}`
                : `✕ ${sourceName(s.source)}: ${s.message ?? "failed"}`
          ), aiLine(r.ai)].filter((l): l is string => Boolean(l))
        );
      setBusy(null);
      router.refresh();
    });
  }

  function runMatch() {
    setBusy("match");
    setLines(["Scoring new jobs against your profile. This can take a minute…"]);
    startTransition(async () => {
      const r = await post<MatchResult>("/api/run/match");
      const out: string[] = [];
      if (r.error) out.push(`✕ ${r.error}`);
      else {
        const a = aiLine(r.ai);
        if (a) out.push(a);
        out.push(`✓ Scored ${r.scored ?? 0} jobs open to Nigeria. ${r.remaining ?? 0} still waiting.`);
        for (const e of (r.errors ?? []).slice(0, 3)) out.push(`✕ ${e}`);
      }
      setLines(out);
      setBusy(null);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-secondary" onClick={runFetch} disabled={pending}>
          {busy === "fetch" ? "Fetching…" : "Fetch new jobs"}
        </button>
        <button type="button" className="btn-secondary" onClick={runMatch} disabled={pending}>
          {busy === "match" ? "Scoring…" : "Score new jobs"}
        </button>
      </div>
      {lines.length > 0 && (
        <ul role="status" aria-live="polite" className="space-y-0.5 text-sm text-muted">
          {lines.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
