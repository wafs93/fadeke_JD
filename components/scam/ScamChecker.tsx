"use client";

import { useState, useTransition } from "react";
import { getSecondOpinion, type SecondOpinion } from "@/app/scam-check/actions";
import { Chip } from "@/components/Chip";
import { NgChip, ScamChip } from "@/components/feed/JobChips";
import { checkNigeriaEligibility, type Eligibility } from "@/lib/eligibility";
import { assessScam, type ScamResult } from "@/lib/scam";

const SAFETY_TIPS = [
  "Never pay to get a job: no training, starter kit, equipment or registration fees.",
  "Never share your BVN, NIN, bank login or card details before a written offer from a real company.",
  "Real employers interview on video or phone, not only by Telegram or WhatsApp chat.",
  "Search the company name with \"scam\" and check it has a real website, then apply there.",
  "Never deposit a cheque or forward money for an employer.",
];

export function ScamChecker() {
  const [post, setPost] = useState("");
  const [company, setCompany] = useState("");
  const [result, setResult] = useState<{ scam: ScamResult; ng: Eligibility } | null>(null);
  const [opinion, setOpinion] = useState<SecondOpinion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function check(e: React.FormEvent) {
    e.preventDefault();
    setOpinion(null);
    setError(null);
    const firstLine = post.trim().split("\n")[0] ?? "";
    setResult({
      scam: assessScam({ title: firstLine, company, description: post }),
      ng: checkNigeriaEligibility("", post, firstLine),
    });
  }

  function ask() {
    setError(null);
    startTransition(async () => {
      const res = await getSecondOpinion(company ? `Company: ${company}\n\n${post}` : post);
      if (res.ok) setOpinion(res.data);
      else setError(res.error);
    });
  }

  const verdictTone = opinion?.verdict === "likely scam" ? "bad" : opinion?.verdict === "be careful" ? "warn" : "good";

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <form onSubmit={check} className="card space-y-5 p-5">
        <div>
          <label htmlFor="post" className="label">
            Job post
          </label>
          <textarea
            id="post"
            rows={14}
            required
            className="input"
            placeholder="Paste the whole post here, including any contact details."
            value={post}
            onChange={(e) => setPost(e.target.value)}
          />
          <p className="hint">Nothing you paste here is saved.</p>
        </div>
        <div>
          <label htmlFor="company" className="label">
            Company name (if given)
          </label>
          <input id="company" className="input" value={company} onChange={(e) => setCompany(e.target.value)} />
        </div>
        <button type="submit" className="btn-primary w-full sm:w-auto" disabled={!post.trim()}>
          Check this post
        </button>
      </form>

      <div className="space-y-4">
        {!result ? (
          <section className="card p-5">
            <h2 className="text-2xl">Stay safe out there</h2>
            <p className="mt-1 text-muted">Paste a post and check it. Until then, five rules that keep you safe:</p>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              {SAFETY_TIPS.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </section>
        ) : (
          <>
            <section aria-live="polite" className="card space-y-3 p-5">
              <h2 className="text-2xl">Result</h2>
              <div className="flex flex-wrap gap-2">
                <ScamChip level={result.scam.level} score={result.scam.score} />
                <NgChip eligible={result.ng.eligible} reason={result.ng.reason} evidence={result.ng.evidence} />
              </div>
              <p className="text-sm text-muted">Nigeria: {result.ng.reason}</p>
              {result.scam.flags.length === 0 ? (
                <p className="text-sm">✓ No common scam signs found. Still check the company yourself before applying.</p>
              ) : (
                <ul className="space-y-2">
                  {result.scam.flags.map((f) => (
                    <li key={f.id}>
                      <span className="font-semibold">! {f.label}</span>
                      {f.evidence && <span className="block break-words text-muted">&ldquo;{f.evidence}&rdquo;</span>}
                    </li>
                  ))}
                </ul>
              )}
              <button type="button" className="btn-secondary w-full sm:w-auto" disabled={pending} onClick={ask}>
                {pending ? "Asking…" : "Ask AI for a second opinion"}
              </button>
              {error && (
                <p role="alert" className="text-sm font-semibold text-[var(--bad-fg)]">
                  ✕ {error}
                </p>
              )}
            </section>

            {opinion && (
              <section aria-live="polite" className="card space-y-3 p-5">
                <h2 className="flex flex-wrap items-center gap-2 text-2xl">
                  Second opinion <Chip tone={verdictTone}>{opinion.verdict[0].toUpperCase() + opinion.verdict.slice(1)}</Chip>
                </h2>
                <ul className="list-disc space-y-1 pl-5">
                  {opinion.reasons.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
                {opinion.next_steps.length > 0 && (
                  <>
                    <h3>What to do next</h3>
                    <ul className="list-disc space-y-1 pl-5">
                      {opinion.next_steps.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </>
                )}
                <p className="text-xs text-muted">AI can be wrong. Trust the safety rules over any verdict.</p>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
