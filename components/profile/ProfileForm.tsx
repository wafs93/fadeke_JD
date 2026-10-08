"use client";

import { useState, useTransition } from "react";
import { saveProfile } from "@/app/profile/actions";
import { StatusText, type SaveStatus } from "@/components/StatusText";
import type { Profile } from "@/lib/types";

function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      {children}
      {hint && (
        <p id={`${id}-hint`} className="hint">
          {hint}
        </p>
      )}
    </div>
  );
}

export function ProfileForm({ profile }: { profile: Profile | null }) {
  const [status, setStatus] = useState<SaveStatus>({ kind: "idle" });
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await saveProfile(formData);
      setStatus(res.ok ? { kind: "saved" } : { kind: "error", message: res.error });
    });
  }

  const list = (items: string[] | undefined) => (items ?? []).join("\n");

  return (
    <form onSubmit={onSubmit} onChange={() => setStatus({ kind: "idle" })} className="card space-y-5 p-4 sm:p-6">
      <h2 className="text-lg font-bold">About you</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="full_name" label="Full name (as on CV)">
          <input id="full_name" name="full_name" className="input" defaultValue={profile?.full_name ?? ""} />
        </Field>
        <Field id="location" label="Location" hint="City and country. No street address needed.">
          <input
            id="location"
            name="location"
            className="input"
            defaultValue={profile?.location ?? ""}
            aria-describedby="location-hint"
          />
        </Field>
        <Field id="email" label="Email for applications">
          <input id="email" name="email" type="email" className="input" defaultValue={profile?.email ?? ""} />
        </Field>
        <Field id="phone" label="Phone (with country code)">
          <input id="phone" name="phone" type="tel" className="input" defaultValue={profile?.phone ?? ""} />
        </Field>
        <Field id="timezone" label="Timezone">
          <input id="timezone" name="timezone" className="input" defaultValue={profile?.timezone ?? "WAT, UTC+1"} />
        </Field>
        <Field
          id="min_hourly_rate"
          label="Minimum hourly rate (USD)"
          hint="Leave blank and kits will show [add rate] for you to fill in."
        >
          <input
            id="min_hourly_rate"
            name="min_hourly_rate"
            type="number"
            min="0"
            step="0.5"
            inputMode="decimal"
            className="input"
            defaultValue={profile?.min_hourly_rate ?? ""}
            aria-describedby="min_hourly_rate-hint"
          />
        </Field>
      </div>

      <Field id="summary" label="Summary">
        <textarea id="summary" name="summary" rows={3} className="input" defaultValue={profile?.summary ?? ""} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="target_titles" label="Job titles to look for" hint="One per line.">
          <textarea
            id="target_titles"
            name="target_titles"
            rows={6}
            className="input"
            defaultValue={list(profile?.target_titles)}
            aria-describedby="target_titles-hint"
          />
        </Field>
        <Field id="skills" label="Skills" hint="One per line.">
          <textarea
            id="skills"
            name="skills"
            rows={6}
            className="input"
            defaultValue={list(profile?.skills)}
            aria-describedby="skills-hint"
          />
        </Field>
        <Field id="tools" label="Tools and software" hint="One per line. Only tools you have really used.">
          <textarea
            id="tools"
            name="tools"
            rows={4}
            className="input"
            defaultValue={list(profile?.tools)}
            aria-describedby="tools-hint"
          />
        </Field>
        <Field id="languages" label="Languages" hint="One per line, for example: English (expert).">
          <textarea
            id="languages"
            name="languages"
            rows={4}
            className="input"
            defaultValue={list(profile?.languages)}
            aria-describedby="languages-hint"
          />
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Saving…" : "Save profile"}
        </button>
        <StatusText status={status} />
      </div>
    </form>
  );
}
