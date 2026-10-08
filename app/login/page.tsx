"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { HeartMark } from "@/components/Icons";
import { APP_NAME } from "@/lib/brand";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <div className="border-b border-line bg-tint px-4 py-5" style={{ paddingTop: "calc(env(safe-area-inset-top) + 20px)" }}>
        <p className="mx-auto flex max-w-sm items-center gap-2 text-ink">
          <HeartMark className="h-7 w-7 text-rose" />
          <span className="font-display text-2xl">{APP_NAME}</span>
        </p>
      </div>
      <div className="flex flex-1 items-start justify-center px-4 pt-10">
        <div className="card w-full max-w-sm p-6">
          <h1 className="text-[2rem] leading-tight">Welcome back</h1>
          <p className="mt-1 text-muted">Sign in to see today&apos;s jobs. This desk is private to you.</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="email" className="label">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label htmlFor="password" className="label">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
              />
            </div>

            {error && (
              <p role="alert" className="rounded-2xl bg-[var(--bad-bg)] px-4 py-3 text-[var(--bad-fg)]">
                {error}
              </p>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
