// OpenAI behind one small seam (000 OpenAI use). Every method resolves to null on any failure
// (no key, network, bad output) so callers always fall back to their deterministic version.
// Tests pass a fake; they never call OpenAI (OV-6).
import type { z } from "zod";

export type LlmRequest = {
  /** Span name suffix: openai.<purpose> (e.g. "theme", "class", "recap"). */
  purpose: string;
  system: string;
  user: string;
};

export interface Llm {
  /** JSON output parsed and validated with `schema`; null if anything goes wrong. */
  json<S extends z.ZodType>(req: LlmRequest, schema: S): Promise<z.infer<S> | null>;
  /** Plain text output; null if anything goes wrong. */
  text(req: LlmRequest): Promise<string | null>;
}

/** OPENAI_API_KEY unset → null: callers use their fallback (OV-5). */
export function llmFromEnv(env: NodeJS.ProcessEnv = process.env, fetchImpl: typeof fetch = fetch): Llm | null {
  const key = env.OPENAI_API_KEY;
  if (!key) return null;
  const model = env.OPENAI_MODEL || "gpt-4.1-mini";

  async function complete(req: LlmRequest, json: boolean): Promise<string | null> {
    try {
      const res = await fetchImpl("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(8000),
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: req.system },
            { role: "user", content: req.user },
          ],
          ...(json ? { response_format: { type: "json_object" } } : {}),
        }),
      });
      if (!res.ok) return null;
      const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      return body.choices?.[0]?.message?.content ?? null;
    } catch {
      return null;
    }
  }

  return {
    async json(req, schema) {
      const out = await complete(req, true);
      if (out === null) return null;
      try {
        const r = schema.safeParse(JSON.parse(out));
        return r.success ? r.data : null;
      } catch {
        return null;
      }
    },
    async text(req) {
      return complete(req, false);
    },
  };
}

/** Test double: answers from `reply(purpose)`; records requests so tests can check no personal text leaks into prompts. */
export function createFakeLlm(reply: (purpose: string) => unknown) {
  const requests: LlmRequest[] = [];
  const llm: Llm = {
    async json(req, schema) {
      requests.push(req);
      const r = schema.safeParse(reply(req.purpose));
      return r.success ? r.data : null;
    },
    async text(req) {
      requests.push(req);
      const out = reply(req.purpose);
      return typeof out === "string" ? out : null;
    },
  };
  return { llm, requests };
}
