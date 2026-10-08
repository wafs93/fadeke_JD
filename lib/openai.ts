import "server-only";
import OpenAI from "openai";

let client: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set. Add it to .env.local (or the Vercel project settings).");
  }
  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
}

export const MODEL = process.env.OPENAI_MODEL || "gpt-4o";
/** Cheap model for small yes/no reading tasks (location eligibility). */
export const MODEL_SMALL = process.env.OPENAI_MODEL_SMALL || "gpt-4o-mini";

/** Turns any error from an OpenAI call into a clear message. Auth and
 * rate-limit failures (401/403/429) are prefixed "OpenAI: " so callers can
 * stop retrying and show them as-is. */
export function formatOpenAiError(e: unknown): string {
  if (e instanceof OpenAI.APIError) {
    if (e.status === 401 || e.status === 403 || e.status === 429) {
      return `OpenAI: ${e.status} ${e.message}`;
    }
    return `OpenAI error ${e.status ?? "?"}: ${e.message}`;
  }
  return e instanceof Error ? e.message : String(e);
}

/** One JSON-mode chat call, validated by `parse`, with one retry on a bad
 * shape. Returns the parsed value or throws with a readable message. */
export async function chatJson<T>(
  system: string,
  user: string,
  parse: (raw: unknown) => { success: true; data: T } | { success: false; error: { message: string } },
  temperature = 0.3,
  model = MODEL
): Promise<T> {
  const openai = getOpenAI();
  let lastError = "unknown error";

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const completion = await openai.chat.completions.create({
        model,
        temperature,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      });
      const raw = completion.choices[0]?.message?.content;
      if (!raw) {
        lastError = "empty response from model";
        continue;
      }
      const parsed = parse(JSON.parse(raw));
      if (parsed.success) return parsed.data;
      lastError = `invalid response shape: ${parsed.error.message.slice(0, 300)}`;
    } catch (e) {
      lastError = formatOpenAiError(e);
      if (/^OpenAI: (401|403|429)/.test(lastError)) break;
    }
  }

  throw new Error(lastError);
}
