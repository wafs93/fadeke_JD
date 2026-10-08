"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "@/app/actions";

export function SignOutButton() {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await signOut();
          router.push("/login");
          router.refresh();
        })
      }
      className="min-h-[44px] whitespace-nowrap rounded-full px-2.5 text-sm font-semibold text-ink hover:bg-raised disabled:opacity-50"
    >
      Sign out
    </button>
  );
}
