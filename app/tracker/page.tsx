import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TrackerBoard, type TrackerCard } from "@/components/tracker/TrackerBoard";
import { Chip } from "@/components/Chip";
import type { Application } from "@/lib/types";
import { todayInLagos } from "@/lib/util";

export const dynamic = "force-dynamic";

export default async function TrackerPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: apps } = await supabase
    .from("applications")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  const applications = (apps as Application[] | null) ?? [];
  const jobIds = applications.map((a) => a.job_id);
  const { data: jobs } = jobIds.length
    ? await supabase.from("jobs").select("id, title, company, url, source").in("id", jobIds)
    : { data: [] };
  const jobMap = new Map((jobs ?? []).map((j: TrackerCard["job"]) => [j.id, j]));

  const cards: TrackerCard[] = applications
    .filter((a) => jobMap.has(a.job_id))
    .map((a) => ({ application: a, job: jobMap.get(a.job_id)! }));

  const today = todayInLagos();
  const due = cards.filter(
    (c) => c.application.follow_up_on && c.application.follow_up_on <= today && ["Applied", "Replied"].includes(c.application.stage)
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-extrabold">Tracker</h1>
        <p className="mt-1 text-sm text-muted">
          Move each job along as things happen. Use the stage menu on a card, or drag it on a computer.
        </p>
      </div>
      {due.length > 0 && (
        <p className="card flex flex-wrap items-center gap-2 p-3 text-sm">
          <Chip tone="warn">Follow up due</Chip>
          {due.length === 1 ? "1 application is" : `${due.length} applications are`} ready for a polite follow-up email:{" "}
          {due.map((c) => c.job.company || c.job.title).join(", ")}.
        </p>
      )}
      <TrackerBoard cards={cards} today={today} />
    </div>
  );
}
