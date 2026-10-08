"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteEducation, saveEducation } from "@/app/profile/actions";
import { StatusText, type SaveStatus } from "@/components/StatusText";
import type { Education } from "@/lib/types";

export function EducationEditor({ education, onDone }: { education: Education | null; onDone?: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<SaveStatus>({ kind: "idle" });
  const [school, setSchool] = useState(education?.school ?? "");
  const [degree, setDegree] = useState(education?.degree ?? "");
  const [field, setField] = useState(education?.field ?? "");
  const [startYear, setStartYear] = useState(education?.start_year?.toString() ?? "");
  const [endYear, setEndYear] = useState(education?.end_year?.toString() ?? "");
  const idBase = education?.id ?? "new-edu";

  function save() {
    startTransition(async () => {
      const res = await saveEducation({
        id: education?.id ?? null,
        school,
        degree,
        field,
        start_year: startYear || null,
        end_year: endYear || null,
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
    if (!education) {
      onDone?.();
      return;
    }
    if (!window.confirm(`Delete ${education.school}? This cannot be undone.`)) return;
    startTransition(async () => {
      const res = await deleteEducation(education.id);
      if (!res.ok) setStatus({ kind: "error", message: res.error });
      router.refresh();
    });
  }

  return (
    <li className="card p-4" onChange={() => setStatus({ kind: "idle" })}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label" htmlFor={`${idBase}-school`}>
            School
          </label>
          <input id={`${idBase}-school`} className="input" value={school} onChange={(e) => setSchool(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor={`${idBase}-degree`}>
            Qualification
          </label>
          <input
            id={`${idBase}-degree`}
            className="input"
            placeholder="B.Sc"
            value={degree}
            onChange={(e) => setDegree(e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor={`${idBase}-field`}>
            Course
          </label>
          <input id={`${idBase}-field`} className="input" value={field} onChange={(e) => setField(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor={`${idBase}-start`}>
            Start year
          </label>
          <input
            id={`${idBase}-start`}
            className="input"
            inputMode="numeric"
            value={startYear}
            onChange={(e) => setStartYear(e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor={`${idBase}-end`}>
            End year
          </label>
          <input
            id={`${idBase}-end`}
            className="input"
            inputMode="numeric"
            value={endYear}
            onChange={(e) => setEndYear(e.target.value)}
          />
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" className="btn-primary btn-sm" disabled={pending} onClick={save}>
          {pending ? "Saving…" : "Save education"}
        </button>
        <button type="button" className="btn-danger btn-sm" disabled={pending} onClick={remove}>
          {education ? "Delete" : "Cancel"}
        </button>
        <StatusText status={status} />
      </div>
    </li>
  );
}

export function AddEducation() {
  const [adding, setAdding] = useState(false);
  if (!adding) {
    return (
      <button type="button" className="btn-secondary" onClick={() => setAdding(true)}>
        Add education
      </button>
    );
  }
  return (
    <ul>
      <EducationEditor education={null} onDone={() => setAdding(false)} />
    </ul>
  );
}
