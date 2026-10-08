import type { SupabaseClient } from "@supabase/supabase-js";

const cache = new Map<string, boolean>();

/** True when `table.column` exists. Lets code run before a migration has
 * been applied, then switch on once it has. Positive results are cached. */
export async function hasColumn(client: SupabaseClient, table: string, column: string): Promise<boolean> {
  const key = `${table}.${column}`;
  if (cache.get(key)) return true;
  const { error } = await client.from(table).select(column).limit(1);
  const ok = !error;
  if (ok) cache.set(key, true);
  return ok;
}
