import Link from "next/link";
import { AddJobForm } from "@/components/add/AddJobForm";
import { BackIcon } from "@/components/Icons";

export const maxDuration = 60;

export default function AddJobPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link href="/" className="btn-secondary">
        <BackIcon className="h-5 w-5" />
        Back to jobs
      </Link>
      <div>
        <h1 className="text-[2rem] leading-tight sm:text-[2.5rem]">Add a job</h1>
        <p className="mt-1 text-muted">
          Found a job somewhere else? Paste it here and the desk checks whether you can apply from Nigeria, looks for scam signs and
          scores your fit. Only you can see jobs you add.
        </p>
      </div>
      <AddJobForm />
    </div>
  );
}
