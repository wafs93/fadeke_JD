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
      className="min-h-[36px] rounded-full border-2 border-[#111] px-3 text-xs font-semibold hover:bg-black/10 disabled:opacity-50"
    >
      Sign out
    </button>
  );
}
