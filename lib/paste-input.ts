import { z } from "zod";

// Client-safe: shared by the "Add a job" form and the server action.

export const PASTE_SOURCES = ["linkedin", "x", "facebook", "whatsapp", "email", "other"] as const;
export type PasteSource = (typeof PASTE_SOURCES)[number];

export const PASTE_SOURCE_LABELS: Record<PasteSource, string> = {
  linkedin: "LinkedIn",
  x: "X",
  facebook: "Facebook",
  whatsapp: "WhatsApp",
  email: "Email",
  other: "Other",
};

export const pasteInputSchema = z.object({
  text: z
    .string()
    .trim()
    .min(80, "Paste the whole post (at least a few sentences), so it can be checked properly.")
    .max(20000, "That post is very long. Paste just the job part."),
  link: z
    .string()
    .trim()
    .max(2000)
    .refine((v) => v === "" || /^https?:\/\/\S+$/i.test(v), "The link should start with http:// or https://")
    .default(""),
  company: z.string().trim().max(120).default(""),
  source: z.enum(PASTE_SOURCES),
});

export type PasteInput = z.infer<typeof pasteInputSchema>;
