"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteExperience, saveExperience } from "@/app/profile/actions";
import { Chip } from "@/components/Chip";
import { StatusText, type SaveStatus } from "@/components/StatusText";
import type { Experience } from "@/lib/types";
import { formatDateRange } from "@/lib/util";

interface BulletDraft {
  text: string;
  tags: string;
}

export function ExperienceEditor({
  experience,
  sortOrder,
  startOpen = false,
  onDone,
}: {
  experience: Experience | null;
  sortOrder: number;
  startOpen?: boolean;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(startOpen);
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<SaveStatus>({ kind: "idle" });

  const [employer, setEmployer] = useState(experience?.employer ?? "");
  const [title, setTitle] = useState(experience?.title ?? "");
  const [start, setStart] = useState(experience?.start_date?.slice(0, 7) ?? "");
  const [end, setEnd] = useState(experience?.end_date?.slice(0, 7) ?? "");
  const [current, setCurrent] = useState(experience?.current ?? false);
  const [location, setLocation] = useState(experience?.location ?? "");
  const [remote, setRemote] = useState(experience?.remote ?? false);
  const [verified, setVerified] = useState(experience?.verified ?? false);
  const [bullets, setBullets] = useState<BulletDraft[]>(
    (experience?.bullets ?? []).map((b) => ({ text: b.text, tags: (b.tags ?? []).join(", ") }))
  );

  const idBase = experience?.id ?? "new";
  const heading = experience ? `${experience.title}, ${experience.employer}` : "New experience";

  function updateBullet(i: number, patch: Partial<BulletDraft>) {
    setBullets((prev) => prev.map((b, idx) => (idx === i ? { ...b, ...patch } : b)));
    setStatus({ kind: "idle" });
  }

  function save() {
    startTransition(async () => {
      const res = await saveExperience({
        id: experience?.id ?? null,
        employer,
        title,
        start_date: start || null,
        end_date: end || null,
        current,
        location: location || null,
        remote,
        verified,
        sort_order: experience?.sort_order ?? sortOrder,
        bullets: bullets.map((b) => ({
          text: b.text,
          tags: b.tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        })),
      });
      if (!res.ok) {
        setStatus({ kind: "error", message: res.error });
        return;
      }
      setStatus({ kind: "saved" });
      router.refresh();
      onDone?.();
    });
  }

  function remove() {
    if (!experience) {
      onDone?.();
      return;
    }
    if (!window.confirm(`Delete "${heading}"? This cannot be undone.`)) return;
    startTransition(async () => {
      const res = await deleteExperience(experience.id);
      if (!res.ok) setStatus({ kind: "error", message: res.error });
      router.refresh();
    });
  }

  return (
    <li className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="break-words text-lg">{heading}</h3>
          {experience && (
            <p className="text-sm text-muted">
              {formatDateRange(experience.start_date, experience.end_date, experience.current) || "Dates not set"}
              {experience.remote ? " · Remote" : experience.location ? ` · ${experience.location}` : ""}
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            {experience && !experience.verified && (
              <Chip tone="warn" title="Not used in application kits until confirmed">
                Needs confirmation
              </Chip>
            )}
            {experience?.verified && <Chip tone="good">Confirmed</Chip>}
            {experience && experience.bullets.length === 0 && <Chip tone="neutral">No duties yet</Chip>}
          </div>
        </div>
        <button
          type="button"
          className="btn-secondary btn-sm"
          aria-expanded={open}
          aria-controls={`exp-${idBase}`}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? "Close" : "Edit"}
        </button>
      </div>

      {experience && !experience.verified && !open && (
        <p className="mt-3 rounded-2xl bg-[var(--warn-bg)] px-4 py-3 text-[var(--warn-fg)]">
          Add the real dates and duties, then tick &quot;I confirm these details are correct&quot;. Until then, application
          kits leave this role&apos;s duties out.
        </p>
      )}

      {open && (
        <div id={`exp-${idBase}`} className="mt-4 space-y-4">
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="label" htmlFor={`${idBase}-title`}>
                Job title
              </label>
              <input id={`${idBase}-title`} className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor={`${idBase}-employer`}>
                Employer
              </label>
              <input
                id={`${idBase}-employer`}
                className="input"
                value={employer}
                onChange={(e) => setEmployer(e.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor={`${idBase}-start`}>
                Start month
              </label>
              <input
                id={`${idBase}-start`}
                type="month"
                className="input"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor={`${idBase}-end`}>
                End month
              </label>
              <input
                id={`${idBase}-end`}
                type="month"
                className="input"
                value={current ? "" : end}
                disabled={current}
                onChange={(e) => setEnd(e.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor={`${idBase}-location`}>
                Location
              </label>
              <input
                id={`${idBase}-location`}
                className="input"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
            <div className="flex flex-col justify-end gap-2">
              <label className="flex min-h-[44px] items-center gap-3">
                <input type="checkbox" className="h-5 w-5 accent-[var(--primary)]" checked={current} onChange={(e) => setCurrent(e.target.checked)} />
                I work here now
              </label>
              <label className="flex min-h-[44px] items-center gap-3">
                <input type="checkbox" className="h-5 w-5 accent-[var(--primary)]" checked={remote} onChange={(e) => setRemote(e.target.checked)} />
                Remote role
              </label>
            </div>
          </div>

          <fieldset>
            <legend className="label">Duties and achievements</legend>
            <p className="hint mb-2">One line each. Tags are optional keywords that help match jobs.</p>
            <ul className="space-y-3">
              {bullets.map((b, i) => (
                <li key={i} className="rounded-2xl bg-sunken p-3">
                  <label className="sr-only" htmlFor={`${idBase}-b${i}`}>
                    Duty {i + 1}
                  </label>
                  <textarea
                    id={`${idBase}-b${i}`}
                    rows={2}
                    className="input"
                    value={b.text}
                    onChange={(e) => updateBullet(i, { text: e.target.value })}
                  />
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <label className="text-sm font-semibold" htmlFor={`${idBase}-t${i}`}>
                      Tags
                    </label>
                    <input
                      id={`${idBase}-t${i}`}
                      className="input flex-1"
                      placeholder="email, calendar"
                      value={b.tags}
                      onChange={(e) => updateBullet(i, { tags: e.target.value })}
                    />
                    <button
                      type="button"
                      className="btn-secondary btn-sm"
                      onClick={() => setBullets((prev) => prev.filter((_, idx) => idx !== i))}
                    >
                      Remove duty
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="btn-secondary btn-sm mt-3"
              onClick={() => setBullets((prev) => [...prev, { text: "", tags: "" }])}
            >
              Add duty
            </button>
          </fieldset>

          <label className="flex items-start gap-3 rounded-2xl bg-tint p-4">
            <input
              type="checkbox"
              className="mt-0.5 h-5 w-5"
              checked={verified}
              onChange={(e) => setVerified(e.target.checked)}
            />
            <span>
              <strong>I confirm these details are correct.</strong> Only confirmed roles have their duties used in CVs and
              cover letters.
            </span>
          </label>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <button type="button" className="btn-primary" disabled={pending} onClick={save}>
              {pending ? "Saving…" : "Save experience"}
            </button>
            <button type="button" className="btn-danger" disabled={pending} onClick={remove}>
              {experience ? "Delete" : "Cancel"}
            </button>
            <StatusText status={status} />
          </div>
        </div>
      )}
    </li>
  );
}

export function AddExperience({ nextSortOrder }: { nextSortOrder: number }) {
  const [adding, setAdding] = useState(false);
  if (!adding) {
    return (
      <button type="button" className="btn-secondary" onClick={() => setAdding(true)}>
        Add experience
      </button>
    );
  }
  return (
    <ul>
      <ExperienceEditor experience={null} sortOrder={nextSortOrder} startOpen onDone={() => setAdding(false)} />
    </ul>
  );
}
