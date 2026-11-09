// Semantic search setup (020 Behavior 2): the conquest-embeddings inference endpoint (OpenAI
// text-embedding-3-small) and the decision whether search uses it. Every step can fail softly
// to BM25 only (OV-5, SR-11): no key, endpoint refused, or a talks index without `semantic`.
import { INDEX } from "@conquest/contracts";
import type { EsPort } from "./es";
import { INFERENCE_ID } from "./indexes";
import type { SearchOptions } from "./queries";

export const EMBEDDING_MODEL = "text-embedding-3-small";
const ENDPOINT_PATH = `/_inference/text_embedding/${INFERENCE_ID}`;

type Log = (level: string, msg: string, extra?: object) => void;
const quiet: Log = () => {};

export function inferenceEndpointBody(apiKey: string) {
  return { service: "openai", service_settings: { api_key: apiKey, model_id: EMBEDDING_MODEL } };
}

/**
 * Make sure the inference endpoint exists. Returns whether embeddings are usable.
 * Never logs the request body (it holds the OpenAI key).
 */
export async function ensureInferenceEndpoint(es: EsPort, env: NodeJS.ProcessEnv = process.env, log: Log = quiet): Promise<boolean> {
  const apiKey = env.OPENAI_API_KEY?.trim();
  if (!apiKey) return false;

  // Self-managed clusters need a trial license for inference, semantic_text and RRF. Elastic
  // Serverless has no license API and already has them, so any answer here is fine.
  await es.request("POST", "/_license/start_trial?acknowledge=true").catch(() => undefined);

  const existing = await es.request("GET", ENDPOINT_PATH);
  if (existing.status === 200) return true;
  const created = await es.request("PUT", ENDPOINT_PATH, inferenceEndpointBody(apiKey));
  if (created.status === 200) {
    log("info", "created inference endpoint", { inference_id: INFERENCE_ID });
    return true;
  }
  log("warn", "could not create inference endpoint; BM25 only", { status: created.status, type: errorTypeOf(created.body) });
  return false;
}

/** Whether the live talks index has the semantic field (an index created without it never gains it). */
export async function talksIndexHasSemantic(es: EsPort): Promise<boolean> {
  const res = await es.request("GET", `/${INDEX.talks}/_mapping`);
  if (res.status !== 200) return false;
  const body = res.body as Record<string, { mappings?: { properties?: Record<string, { type?: string }> } }>;
  return Object.values(body).some((i) => i.mappings?.properties?.semantic?.type === "semantic_text");
}

/** Search options once indexes exist: semantic + RRF only when every piece is in place. */
export async function searchOptions(es: EsPort, embeddings: boolean, log: Log = quiet): Promise<SearchOptions> {
  if (!embeddings) return { semantic: false, rrf: false };
  if (!(await talksIndexHasSemantic(es))) {
    log("warn", "talks index has no semantic field; BM25 only until it is recreated (npm run seed -w services/search-api -- --recreate)");
    return { semantic: false, rrf: false };
  }
  return { semantic: true, rrf: true };
}

function errorTypeOf(body: unknown): string | undefined {
  return (body as { error?: { type?: string } } | null)?.error?.type;
}
