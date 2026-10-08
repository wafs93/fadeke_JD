import { z } from "zod";
import config from "@/config/companies.json";

export const BOARDS = ["greenhouse", "lever", "ashby", "workable"] as const;
export type Board = (typeof BOARDS)[number];

const companySchema = z.object({
  board: z.enum(BOARDS),
  slug: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9._-]+$/, "slug may only contain letters, numbers, dots, dashes and underscores"),
  name: z.string().trim().min(1),
});

export type Company = z.infer<typeof companySchema>;

export const companiesSchema = z.object({ companies: z.array(companySchema) });

/** Companies from config/companies.json. A bad entry is a config mistake, so
 * it throws with a clear message instead of being skipped silently. */
export function loadCompanies(raw: unknown = config): Company[] {
  const parsed = companiesSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`config/companies.json: ${parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`);
  }
  return parsed.data.companies;
}

export function companiesFor(board: Board, raw?: unknown): Company[] {
  return loadCompanies(raw).filter((c) => c.board === board);
}
