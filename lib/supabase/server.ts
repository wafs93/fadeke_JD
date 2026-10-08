import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/** Session-bound client for server components, server actions and /api/run
 * routes. Runs as the signed-in user, so RLS applies. */
export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // called from a Server Component — safe to ignore when middleware
            // is also refreshing sessions.
          }
        },
      },
    }
  );
}

/** The signed-in user, or null. */
export async function getUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
