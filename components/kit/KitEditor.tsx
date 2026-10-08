"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveKit } from "@/app/jobs/[id]/kit/actions";
import { StatusText, type SaveStatus } from "@/components/StatusText";
import type { Kit } from "@/lib/types";
import { findPlaceholders } from "@/lib/util";

type Field = "cv_text" | "cover_letter" | "answers_text";

const SECTIONS: { field: Field; title: string; rows: number; hint: string }[] = [
  {
    field: "cv_text",
    title: "CV",
    rows: 22,
    hint: "## starts a section, ### a role, - a bullet. Keep that layout and the Word file stays neat.",
  },
  { field: "cover_letter", title: "Cover letter", rows: 16, hint: "Leave a blank line between paragraphs." },
  { field: "answers_text", title: "Answers to common questions", rows: 14, hint: "Copy each answer into the application form." },
];

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn-secondary btn-sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          setCopied(false);
        }
      }}
    >
      {copied ? "✓ Copied" : `Copy ${label.toLowerCase()}`}
    </button>
  );
}

export function KitEditor({ kit, jobId }: { kit: Kit; jobId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<SaveStatus>({ kind: "idle" });
  const [texts, setTexts] = useState<Record<Field, string>>({
    cv_text: kit.cv_text,
    cover_letter: kit.cover_letter,
    answers_text: kit.answers_text,
  });
  const dirty =
    texts.cv_text !== kit.cv_text || texts.cover_letter !== kit.cover_letter || texts.answers_text !== kit.answers_text;

  const livePlaceholders = useMemo(
    () => SECTIONS.map((s) => ({ title: s.title, items: findPlaceholders(texts[s.field]) })).filter((p) => p.items.length),
    [texts]
  );

  function save() {
    startTransition(async () => {
      const res = await saveKit(kit.id, jobId, texts);
      setStatus(res.ok ? { kind: "saved" } : { kind: "error", message: res.error });
      if (res.ok) router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      {livePlaceholders.length > 0 && (
        <section aria-labelledby="ph-heading" className="card border-2 border-[var(--warn-fg)] p-4">
          <h2 id="ph-heading" className="font-bold">
            ! Fill these in before you send
          </h2>
          <ul className="mt-2 space-y-1 text-sm">
            {livePlaceholders.map((p) => (
              <li key={p.title}>
                <span className="font-semibold">{p.title}:</span>{" "}
                {p.items.map((it) => (
                  <span key={it} className="placeholder-mark mr-1">
                    {it}
                  </span>
                ))}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="no-print sticky top-0 z-10 -mx-4 flex flex-wrap items-center gap-2 border-b border-line bg-surface/95 px-4 py-2 backdrop-blur sm:mx-0 sm:rounded-lg sm:border">
        <button type="button" className="btn-primary" disabled={pending || !dirty} onClick={save}>
          {pending ? "Saving…" : "Save changes"}
        </button>
        {dirty && <span className="text-sm font-semibold">• Unsaved changes</span>}
        <StatusText status={dirty ? { kind: "idle" } : status} />
      </div>

      {SECTIONS.map((s) => (
        <section key={s.field} aria-labelledby={`${s.field}-h`} className="card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id={`${s.field}-h`} className="text-lg font-bold">
              <label htmlFor={s.field}>{s.title}</label>
            </h2>
            <div className="flex flex-wrap gap-2">
              <CopyButton text={texts[s.field]} label={s.title} />
              {s.field !== "answers_text" && (
                <a
                  className="btn-secondary btn-sm"
                  href={`/api/kits/${jobId}/docx?doc=${s.field === "cv_text" ? "cv" : "cover"}`}
                  aria-disabled={dirty}
                  onClick={(e) => {
                    if (dirty) {
                      e.preventDefault();
                      window.alert("Save your changes first, so the Word file includes them.");
                    }
                  }}
                >
                  Download .docx
                </a>
              )}
              <a
                className="btn-secondary btn-sm"
                href={`/jobs/${jobId}/kit/print?doc=${s.field === "cv_text" ? "cv" : s.field === "cover_letter" ? "cover" : "answers"}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Print or save PDF
              </a>
            </div>
          </div>
          <p id={`${s.field}-hint`} className="hint mb-2">
            {s.hint}
          </p>
          <textarea
            id={s.field}
            aria-describedby={`${s.field}-hint`}
            rows={s.rows}
            className="input font-mono text-sm leading-relaxed"
            value={texts[s.field]}
            onChange={(e) => {
              setTexts((t) => ({ ...t, [s.field]: e.target.value }));
              setStatus({ kind: "idle" });
            }}
          />
        </section>
      ))}
    </div>
  );
}
