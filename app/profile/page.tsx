import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadProfileBundle, missingProfileDetails } from "@/lib/profile";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { AddExperience, ExperienceEditor } from "@/components/profile/ExperienceEditor";
import { AddEducation, EducationEditor } from "@/components/profile/EducationEditor";
import { Chip } from "@/components/Chip";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const bundle = await loadProfileBundle(supabase, user.id);
  const missing = missingProfileDetails(bundle);
  const unverified = bundle.experiences.filter((e) => !e.verified);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold">Profile</h1>
        <p className="mt-1 text-muted">
          Your master profile. Every CV, cover letter and answer is built only from what is saved here.
        </p>
      </div>

      {(missing.length > 0 || unverified.length > 0) && (
        <section aria-labelledby="todo-heading" className="card border-2 border-[var(--warn-fg)] p-4">
          <h2 id="todo-heading" className="font-bold">
            To finish your profile
          </h2>
          <ul className="mt-2 space-y-2 text-sm">
            {missing.length > 0 && (
              <li className="flex flex-wrap items-center gap-2">
                <Chip tone="warn">Missing</Chip>
                {missing.join(", ")}. Kits show a [placeholder] for each until you add them.
              </li>
            )}
            {unverified.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-2">
                <Chip tone="warn">Needs confirmation</Chip>
                {e.title}, {e.employer}
              </li>
            ))}
          </ul>
        </section>
      )}

      <ProfileForm profile={bundle.profile} />

      <section aria-labelledby="exp-heading" className="space-y-3">
        <h2 id="exp-heading" className="text-xl font-bold">
          Experience
        </h2>
        <ul className="space-y-3">
          {bundle.experiences.map((exp, i) => (
            <ExperienceEditor key={exp.id} experience={exp} sortOrder={i} />
          ))}
        </ul>
        <AddExperience nextSortOrder={bundle.experiences.length} />
      </section>

      <section aria-labelledby="edu-heading" className="space-y-3">
        <h2 id="edu-heading" className="text-xl font-bold">
          Education
        </h2>
        <ul className="space-y-3">
          {bundle.education.map((edu) => (
            <EducationEditor key={edu.id} education={edu} />
          ))}
        </ul>
        <AddEducation />
      </section>
    </div>
  );
}
