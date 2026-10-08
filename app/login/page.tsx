"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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
    <div className="flex min-h-screen flex-col">
      <div className="danfo-band border-b-[6px] border-[#111] bg-danfo px-4 py-6 text-[#111]">
        <p className="mx-auto max-w-sm font-display text-2xl font-extrabold">Fadeke&apos;s Job Desk</p>
      </div>
      <div className="flex flex-1 items-start justify-center px-4 pt-10">
        <div className="card w-full max-w-sm p-6">
          <h1 className="text-xl font-bold">Sign in</h1>
          <p className="mt-1 text-sm text-muted">This desk is private. Use the account set up for you in Supabase.</p>

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
              <p role="alert" className="rounded-lg bg-[var(--bad-bg)] px-3 py-2 text-sm text-[var(--bad-fg)]">
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
