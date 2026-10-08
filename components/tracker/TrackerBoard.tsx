"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { removeApplication, updateApplication } from "@/app/jobs/actions";
import { Chip } from "@/components/Chip";
import { STAGES, type Application, type Stage } from "@/lib/types";
import { sourceName } from "@/lib/util";

export interface TrackerCard {
  application: Application;
  job: { id: string; title: string; company: string; url: string; source: string };
}

const STAGE_HINT: Record<Stage, string> = {
  Saved: "Jobs you want to apply for",
  Applied: "Sent on the company's site",
  Replied: "They wrote back",
  Interview: "Interview booked or done",
  Offer: "Offer received",
  Rejected: "Closed",
};

function Card({ card, today }: { card: TrackerCard; today: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState(card.application.notes ?? "");
  const [appliedOn, setAppliedOn] = useState(card.application.applied_on ?? "");
  const [followUp, setFollowUp] = useState(card.application.follow_up_on ?? "");
  const [error, setError] = useState<string | null>(null);
  const a = card.application;

  const due = a.follow_up_on && a.follow_up_on <= today && ["Applied", "Replied"].includes(a.stage);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Something went wrong");
      router.refresh();
    });
  }

  return (
    <li
      draggable
      onDragStart={(e) => e.dataTransfer.setData("text/plain", a.id)}
      className={`card p-4 ${pending ? "opacity-60" : ""}`}
    >
      <Link href={`/?job=${card.job.id}`} className="block break-words font-semibold leading-snug text-ink hover:underline">
        {card.job.title}
      </Link>
      <p className="break-words text-sm text-muted">
        {card.job.company || "Company not named"} · {sourceName(card.job.source)}
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {a.applied_on && <Chip tone="neutral" symbol={null}>Applied {a.applied_on}</Chip>}
        {due ? (
          <Chip tone="warn">Follow up due</Chip>
        ) : (
          a.follow_up_on && ["Applied", "Replied"].includes(a.stage) && <Chip tone="neutral" symbol={null}>Follow up {a.follow_up_on}</Chip>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor={`stage-${a.id}`}>
          Move {card.job.title} to stage
        </label>
        <select
          id={`stage-${a.id}`}
          className="input w-auto min-w-0 flex-1 rounded-full"
          value={a.stage}
          disabled={pending}
          onChange={(e) => run(() => updateApplication(a.id, { stage: e.target.value as Stage }))}
        >
          {STAGES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button type="button" className="btn-secondary btn-sm" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          {open ? "Close" : "Details"}
        </button>
      </div>

      {open && (
        <div className="mt-3 space-y-3 border-t border-line pt-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor={`applied-${a.id}`}>
                Applied on
              </label>
              <input id={`applied-${a.id}`} type="date" className="input" value={appliedOn} onChange={(e) => setAppliedOn(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor={`follow-${a.id}`}>
                Follow up on
              </label>
              <input id={`follow-${a.id}`} type="date" className="input" value={followUp} onChange={(e) => setFollowUp(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label" htmlFor={`notes-${a.id}`}>
              Notes
            </label>
            <textarea id={`notes-${a.id}`} rows={3} className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              className="btn-primary btn-sm w-full sm:w-auto"
              disabled={pending}
              onClick={() =>
                run(() => updateApplication(a.id, { notes, applied_on: appliedOn || null, follow_up_on: followUp || null }))
              }
            >
              Save details
            </button>
            <Link href={`/jobs/${card.job.id}/kit`} className="btn-secondary btn-sm w-full sm:w-auto">
              Application kit
            </Link>
            <a href={card.job.url} target="_blank" rel="noopener noreferrer" className="btn-secondary btn-sm w-full sm:w-auto">
              Original post <span aria-hidden="true">↗</span>
            </a>
            <button
              type="button"
              className="btn-danger btn-sm w-full sm:w-auto"
              disabled={pending}
              onClick={() => {
                if (window.confirm("Remove this job from the tracker?")) run(() => removeApplication(a.id));
              }}
            >
              Remove
            </button>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm font-semibold text-[var(--bad-fg)]">
          ✕ {error}
        </p>
      )}
    </li>
  );
}

const EMPTY: Record<Stage, string> = {
  Saved: "Save a job from the feed and it lands here.",
  Applied: "Once you apply, tap \"I submitted it\" on the job and it moves here.",
  Replied: "Replies from employers will show here. Fingers crossed!",
  Interview: "Interviews you have booked will show here.",
  Offer: "Your offers will show here.",
  Rejected: "Closed applications rest here. Each one is practice for the next.",
};

export function TrackerBoard({ cards, today }: { cards: TrackerCard[]; today: string }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [over, setOver] = useState<Stage | null>(null);
  // Phones show one stage at a time; start on the first stage with jobs in it.
  const [mobileStage, setMobileStage] = useState<Stage>(
    () => STAGES.find((s) => cards.some((c) => c.application.stage === s)) ?? "Saved"
  );

  function drop(stage: Stage, id: string) {
    setOver(null);
    const card = cards.find((c) => c.application.id === id);
    if (!card || card.application.stage === stage) return;
    startTransition(async () => {
      await updateApplication(id, { stage });
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div
        role="tablist"
        aria-label="Stages"
        className="scroll-row sticky top-0 z-20 -mx-4 bg-surface/95 px-4 py-2 backdrop-blur xl:hidden"
      >
        {STAGES.map((stage) => {
          const n = cards.filter((c) => c.application.stage === stage).length;
          return (
            <button
              key={stage}
              type="button"
              role="tab"
              aria-selected={mobileStage === stage}
              aria-controls={`col-panel-${stage}`}
              className="pill"
              onClick={() => setMobileStage(stage)}
            >
              {stage}
              <span className="rounded-full bg-tint px-2 text-xs text-ink">{n}</span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-4 xl:grid-cols-6">
        {STAGES.map((stage) => {
          const inStage = cards.filter((c) => c.application.stage === stage);
          return (
            <section
              key={stage}
              id={`col-panel-${stage}`}
              aria-labelledby={`col-${stage}`}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(stage);
              }}
              onDragLeave={() => setOver((s) => (s === stage ? null : s))}
              onDrop={(e) => {
                e.preventDefault();
                drop(stage, e.dataTransfer.getData("text/plain"));
              }}
              className={`min-w-0 rounded-2xl border-2 p-3 ${mobileStage === stage ? "" : "hidden xl:block"} ${
                over === stage ? "border-[var(--primary)] bg-tint" : "border-transparent bg-sunken"
              }`}
            >
              <header className="px-1 pb-3">
                <h2 id={`col-${stage}`} className="flex items-center justify-between text-xl">
                  {stage}
                  <span className="rounded-full bg-raised px-2.5 font-sans text-sm" aria-label={`${inStage.length} jobs`}>
                    {inStage.length}
                  </span>
                </h2>
                <p className="text-sm text-muted">{STAGE_HINT[stage]}</p>
              </header>
              <ul className="space-y-3">
                {inStage.map((c) => (
                  <Card key={c.application.id} card={c} today={today} />
                ))}
                {inStage.length === 0 && <li className="rounded-xl bg-raised/60 p-3 text-sm text-muted">{EMPTY[stage]}</li>}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
