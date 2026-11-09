import { INDEX } from "@conquest/contracts";
import { describe, expect, it } from "vitest";
import { loadSchedule } from "./data";
import { ensureInferenceEndpoint, inferenceEndpointBody, searchOptions } from "./embeddings";
import { clientFromEnv, esPort, type SearchResult } from "./es";
import { ensureIndexes } from "./indexes";
import { searchTalksBody } from "./queries";
import { seed } from "./seed";
import { EsTalkStore } from "./store";
import { MemoryEs } from "./testing/memory-es";

const KEY = { OPENAI_API_KEY: "sk-test-not-real" };
const semanticMapping = { [INDEX.talks]: { mappings: { properties: { semantic: { type: "semantic_text" } } } } };

describe("embeddings and hybrid search (S.4)", () => {
  it("SR-11 with OPENAI_API_KEY unset nothing is created and search is BM25 only", async () => {
    const es = new MemoryEs();
    expect(await ensureInferenceEndpoint(es, {})).toBe(false);
    expect(es.requests).toEqual([]);
    expect(await searchOptions(es, false)).toEqual({ semantic: false, rrf: false });
  });

  it("SR-5 creates the conquest-embeddings endpoint (OpenAI text-embedding-3-small) when it is missing", async () => {
    const es = new MemoryEs();
    es.respond = (method, path) => (method === "GET" && path.startsWith("/_inference") ? { status: 404, body: {} } : { status: 200, body: {} });
    expect(await ensureInferenceEndpoint(es, KEY)).toBe(true);
    const put = es.requests.find((r) => r.method === "PUT")!;
    expect(put.path).toBe("/_inference/text_embedding/conquest-embeddings");
    expect(put.body).toEqual({ service: "openai", service_settings: { api_key: "sk-test-not-real", model_id: "text-embedding-3-small" } });
    expect(es.requests[0]!.path).toBe("/_license/start_trial?acknowledge=true");
  });

  it("SR-5 leaves an existing endpoint alone", async () => {
    const es = new MemoryEs();
    expect(await ensureInferenceEndpoint(es, KEY)).toBe(true);
    expect(es.requests.some((r) => r.method === "PUT")).toBe(false);
  });

  it("SR-11 a refused endpoint falls back to BM25 and logs no key", async () => {
    const es = new MemoryEs();
    const logs: string[] = [];
    es.respond = (method) => (method === "POST" ? { status: 200, body: {} } : { status: method === "GET" ? 404 : 400, body: { error: { type: "status_exception" } } });
    expect(await ensureInferenceEndpoint(es, KEY, (...a) => logs.push(JSON.stringify(a)))).toBe(false);
    expect(logs.join()).not.toContain(KEY.OPENAI_API_KEY);
    expect(JSON.stringify(inferenceEndpointBody("k"))).toContain('"api_key":"k"');
  });

  it("SR-11 a talks index created without `semantic` keeps search BM25 only", async () => {
    const es = new MemoryEs();
    es.respond = () => ({ status: 200, body: { [INDEX.talks]: { mappings: { properties: { title: { type: "text" } } } } } });
    expect(await searchOptions(es, true)).toEqual({ semantic: false, rrf: false });
    es.respond = () => ({ status: 200, body: semanticMapping });
    expect(await searchOptions(es, true)).toEqual({ semantic: true, rrf: true });
  });

  it("SR-5 hybrid search is an rrf retriever over the keyword and semantic queries", () => {
    const body = searchTalksBody("keeping my cluster from getting hacked", 5, { semantic: true, rrf: true });
    expect(body.retriever).toEqual({
      rrf: {
        retrievers: [
          { standard: { query: { multi_match: { query: "keeping my cluster from getting hacked", fields: ["title^3", "abstract", "speaker_names^2", "tags^2"], fuzziness: "AUTO" } } } },
          { standard: { query: { semantic: { field: "semantic", query: "keeping my cluster from getting hacked" } } } },
        ],
        rank_window_size: 50,
      },
    });
    expect(body).toHaveProperty("highlight");
  });

  it("SR-5 when the cluster refuses RRF, search retries as bool.should with semantic boosted 2x, and stays there", async () => {
    const bodies: Record<string, unknown>[] = [];
    const es = new MemoryEs();
    es.search = async <T,>(_i: string, body: Record<string, unknown>): Promise<SearchResult<T>> => {
      bodies.push(body);
      if ("retriever" in body) throw Object.assign(new Error("bad"), { meta: { statusCode: 400, body: { error: { type: "x_content_parse_exception", reason: "unknown retriever [rrf]" } } } });
      return { hits: [], total: 0, aggregations: null };
    };
    const store = new EsTalkStore(es, { semantic: true, rrf: true });
    await store.searchTalks("hacked", 5);
    await store.searchTalks("hacked", 5);
    expect(bodies.map((b) => ("retriever" in b ? "rrf" : "bool"))).toEqual(["rrf", "bool", "bool"]);
    expect(bodies[1]!.query).toEqual({
      bool: { should: [{ multi_match: { query: "hacked", fields: ["title^3", "abstract", "speaker_names^2", "tags^2"], fuzziness: "AUTO" } }, { semantic: { field: "semantic", query: "hacked", boost: 2 } }] },
    });
    expect(store.options).toEqual({ semantic: true, rrf: false });
  });

  it("SR-5 other search errors are not swallowed by the RRF fallback", async () => {
    const es = new MemoryEs();
    es.search = async () => {
      throw Object.assign(new Error("down"), { meta: { statusCode: 503 } });
    };
    await expect(new EsTalkStore(es, { semantic: true, rrf: true }).searchTalks("x", 5)).rejects.toThrow("down");
  });

  it("SR-11 with embeddings on, a fresh talks index gets the semantic field", async () => {
    const es = new MemoryEs();
    await ensureIndexes(es, { semantic: true });
    expect(JSON.stringify(es.indexes.get(INDEX.talks)!.body)).toContain('"semantic_text"');
  });
});

describe.runIf(process.env.ES_INTEGRATION === "1" && !!process.env.OPENAI_API_KEY)("semantic search on a local Elasticsearch (ES_INTEGRATION=1 + OPENAI_API_KEY)", () => {
  it("SR-5 a query with no shared words but the same meaning returns security talks in the top 5", async () => {
    const es = esPort(clientFromEnv());
    await es.request("DELETE", `/${INDEX.talks}`);
    expect(await ensureInferenceEndpoint(es)).toBe(true);
    await seed(es, await loadSchedule(), { semantic: true });
    const store = new EsTalkStore(es, await searchOptions(es, true));
    const top = await store.searchTalks("keeping my cluster from getting hacked", 5);
    const security = top.filter(({ talk }) => talk.track === "Security" || talk.tags.includes("security") || /secur/i.test(talk.title));
    expect(security.length).toBeGreaterThan(0);
  }, 600_000);
});
