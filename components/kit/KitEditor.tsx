"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveKit } from "@/app/jobs/[id]/kit/actions";
import { StatusText, type SaveStatus } from "@/components/StatusText";
import type { Kit } from "@/lib/types";
import { findPlaceholders } from "@/lib/util";

type Field = "cv_text" | "cover_letter" | "answers_text";

const SECTIONS: { field: Field; title: string; rows: number; hint: string; doc: "cv" | "cover" | "answers" }[] = [
  {
    field: "cv_text",
    title: "CV",
    rows: 22,
    hint: "## starts a section, ### a role, - a bullet. Keep that layout and the Word file stays neat.",
    doc: "cv",
  },
  { field: "cover_letter", title: "Cover letter", rows: 16, hint: "Leave a blank line between paragraphs.", doc: "cover" },
  { field: "answers_text", title: "Answers", rows: 16, hint: "Copy each answer into the application form.", doc: "answers" },
];

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn-secondary w-full sm:w-auto"
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
  const [tab, setTab] = useState<Field>("cv_text");
  const [texts, setTexts] = useState<Record<Field, string>>({
    cv_text: kit.cv_text,
    cover_letter: kit.cover_letter,
    answers_text: kit.answers_text,
  });
  const dirty =
    texts.cv_text !== kit.cv_text || texts.cover_letter !== kit.cover_letter || texts.answers_text !== kit.answers_text;

  const placeholders = useMemo(
    () => SECTIONS.map((s) => ({ field: s.field, title: s.title, items: findPlaceholders(texts[s.field]) })),
    [texts]
  );
  const anyPlaceholders = placeholders.some((p) => p.items.length);
  const section = SECTIONS.find((s) => s.field === tab)!;

  function save() {
    startTransition(async () => {
      const res = await saveKit(kit.id, jobId, texts);
      setStatus(res.ok ? { kind: "saved" } : { kind: "error", message: res.error });
      if (res.ok) router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {anyPlaceholders && (
        <section aria-labelledby="ph-heading" className="rounded-2xl bg-[var(--warn-bg)] p-5 text-[var(--warn-fg)]">
          <h2 id="ph-heading" className="text-xl">
            ! Fill these in before you send
          </h2>
          <ul className="mt-2 space-y-2">
            {placeholders
              .filter((p) => p.items.length)
              .map((p) => (
                <li key={p.title} className="break-words">
                  <span className="font-semibold">{p.title}:</span>{" "}
                  {p.items.map((it) => (
                    <span key={it} className="placeholder-mark mr-1 inline-block">
                      {it}
                    </span>
                  ))}
                </li>
              ))}
          </ul>
        </section>
      )}

      <div role="tablist" aria-label="Kit documents" className="scroll-row -mx-4 px-4 sm:mx-0 sm:px-0">
        {SECTIONS.map((s) => {
          const count = placeholders.find((p) => p.field === s.field)?.items.length ?? 0;
          return (
            <button
              key={s.field}
              type="button"
              role="tab"
              id={`tab-${s.field}`}
              aria-selected={tab === s.field}
              aria-controls={`panel-${s.field}`}
              className="pill"
              onClick={() => setTab(s.field)}
            >
              {s.title}
              {count > 0 && (
                <span className="rounded-full bg-[var(--warn-bg)] px-2 text-xs text-[var(--warn-fg)]">
                  {count} to fill
                </span>
              )}
            </button>
          );
        })}
      </div>

      <section
        role="tabpanel"
        id={`panel-${section.field}`}
        aria-labelledby={`tab-${section.field}`}
        className="card space-y-3 p-4 sm:p-5"
      >
        <label htmlFor={section.field} className="font-display block text-2xl">
          {section.title}
        </label>
        <p id={`${section.field}-hint`} className="text-sm text-muted">
          {section.hint}
        </p>
        <textarea
          id={section.field}
          aria-describedby={`${section.field}-hint`}
          rows={section.rows}
          className="input w-full font-mono leading-relaxed"
          value={texts[section.field]}
          onChange={(e) => {
            setTexts((t) => ({ ...t, [section.field]: e.target.value }));
            setStatus({ kind: "idle" });
          }}
        />
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <CopyButton text={texts[section.field]} label={section.title} />
          {section.doc !== "answers" && (
            <a
              className="btn-secondary w-full sm:w-auto"
              href={`/api/kits/${jobId}/docx?doc=${section.doc}`}
              aria-disabled={dirty}
              onClick={(e) => {
                if (dirty) {
                  e.preventDefault();
                  window.alert("Save your changes first, so the Word file includes them.");
                }
              }}
            >
              Download Word file
            </a>
          )}
          <a
            className="btn-secondary w-full sm:w-auto"
            href={`/jobs/${jobId}/kit/print?doc=${section.doc}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Print or save PDF
          </a>
        </div>
      </section>

      {/* Save stays in reach on phones, above the tab bar. */}
      <div className="no-print sticky bottom-[calc(var(--tabbar-h)+env(safe-area-inset-bottom)+8px)] z-10 flex flex-wrap items-center gap-3 rounded-full border border-line bg-raised p-2 pl-4 shadow-[var(--shadow)] lg:bottom-4">
        <span className="min-w-0 flex-1 text-sm font-semibold">
          {dirty ? "• Unsaved changes" : <StatusText status={status} />}
        </span>
        <button type="button" className="btn-primary" disabled={pending || !dirty} onClick={save}>
          {pending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}
