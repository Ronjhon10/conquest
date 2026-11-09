import { readFileSync } from "node:fs";
import { ErrorBody, GetSpeakerResponse, GetTalkResponse, INDEX, SearchTalksResponse } from "@conquest/contracts";
import { parseNdjson } from "@conquest/seed";
import { describe, expect, it } from "vitest";
import { createApp } from "./app";
import { DATA_FILE } from "./data";
import { clientFromEnv, esPort, type EsPort, type SearchResult } from "./es";
import { ensureIndexes } from "./indexes";
import { searchTalksBody } from "./queries";
import { seed, toTalkDoc } from "./seed";
import { EsTalkStore } from "./store";
import { MemoryEs } from "./testing/memory-es";
import { MemoryTalkStore } from "./testing/memory-store";

const data = parseNdjson(readFileSync(DATA_FILE, "utf8"));
const app = createApp({ store: new MemoryTalkStore(data) });

async function search(q: string, limit = 20) {
  const res = await app.request(`/api/search/talks?q=${encodeURIComponent(q)}&limit=${limit}`);
  expect(res.status).toBe(200);
  return SearchTalksResponse.parse(await res.json()).results;
}

const mentions = (word: RegExp) => (t: { title: string; abstract: string; tags: string[] }) =>
  word.test(t.title) || word.test(t.abstract) || t.tags.some((g) => word.test(g));

/** Captures search bodies; answers with the given talk docs. */
class CapturingEs extends MemoryEs {
  bodies: Record<string, unknown>[] = [];
  constructor(private readonly answer: (body: Record<string, unknown>) => SearchResult<unknown>) {
    super();
  }
  override async search<T>(_index: string, body: Record<string, unknown>): Promise<SearchResult<T>> {
    this.bodies.push(body);
    return this.answer(body) as SearchResult<T>;
  }
}

describe("GET /talks, /talks/:id, /speakers/:id (S.3)", () => {
  it("SR-3 ?q=ebpf returns talks mentioning eBPF first, each with a highlight", async () => {
    const ebpf = mentions(/ebpf/i);
    const expected = data.talks.filter(ebpf).length;
    expect(expected).toBeGreaterThan(3);
    const results = await search("ebpf");
    const top = results.slice(0, Math.min(expected, results.length));
    for (const r of top) expect(ebpf(r.talk), r.talk.title).toBe(true);
    for (const r of results) expect(r.highlight).toBeTruthy();
    expect(top[0]!.highlight).toMatch(/<em>ebpf<\/em>/i);
  });

  it("SR-3 the Elasticsearch query highlights one 160-char abstract fragment, even when only the title matched", () => {
    const body = searchTalksBody("ebpf", 20, { semantic: false, rrf: false });
    expect(body.highlight).toEqual({ fields: { abstract: { fragment_size: 160, number_of_fragments: 1, no_match_size: 160 } } });
  });

  it("SR-4 a misspelled query (kubernets security) still returns security talks", async () => {
    const results = await search("kubernets security", 5);
    expect(results).toHaveLength(5);
    for (const r of results) expect(mentions(/secur/i)(r.talk), r.talk.title).toBe(true);
    expect(results.some((r) => /kubernetes/i.test(r.talk.title + r.talk.abstract))).toBe(true);
  });

  it("SR-4 the Elasticsearch query is a fuzzy multi_match over the 020 fields and boosts", () => {
    expect(searchTalksBody("kubernets security", 5, { semantic: false, rrf: false }).query).toEqual({
      multi_match: { query: "kubernets security", fields: ["title^3", "abstract", "speaker_names^2", "tags^2"], fuzziness: "AUTO" },
    });
  });

  it("SR-11 without embeddings, EsTalkStore searches with BM25 only and maps hits back to contract Talks", async () => {
    const talk = data.talks[0]!;
    const doc = toTalkDoc(talk, new Map(data.speakers.map((s) => [s.id, s])));
    const es = new CapturingEs(() => ({ total: 1, aggregations: null, hits: [{ id: talk.id, score: 3.2, source: doc, highlight: { abstract: ["x <em>y</em>"] } }] }));
    const results = await new EsTalkStore(es).searchTalks("y", 20);
    expect(results).toEqual([{ talk, score: 3.2, highlight: "x <em>y</em>" }]);
    expect(JSON.stringify(es.bodies[0])).not.toContain("semantic");
    expect(es.bodies[0]).not.toHaveProperty("retriever");
  });

  it("SR-11 the service answers search with no OpenAI key and no Elasticsearch (in-memory fallback)", async () => {
    expect(process.env.OPENAI_API_KEY ?? "").toBe("");
    expect((await app.request("/readyz")).status).toBe(200);
    expect((await search("observability")).length).toBeGreaterThan(0);
  });

  it("SR-3 an empty query lists talks in time order", async () => {
    const results = await search("", 10);
    expect(results).toHaveLength(10);
    const starts = results.map((r) => r.talk.starts_at);
    expect([...starts].sort()).toEqual(starts);
  });

  it("SR-12 GET /talks/:id for an unknown id returns 404 with the 000 error shape", async () => {
    const res = await app.request("/api/search/talks/talk-nope");
    expect(res.status).toBe(404);
    expect(ErrorBody.parse(await res.json()).error.code).toBe("not_found");
  });

  it("SR-12 GET /talks/:id returns the talk and its speakers", async () => {
    const talk = data.talks.find((t) => t.speaker_ids.length > 1)!;
    const res = await app.request(`/api/search/talks/${talk.id}`);
    expect(res.status).toBe(200);
    const body = GetTalkResponse.parse(await res.json());
    expect(body.talk).toEqual(talk);
    expect(body.speakers.map((s) => s.id)).toEqual(talk.speaker_ids);
  });

  it("SR-12 GET /speakers/:id returns the speaker and their talks; unknown is 404", async () => {
    const talk = data.talks[0]!;
    const res = await app.request(`/api/search/speakers/${talk.speaker_ids[0]}`);
    const body = GetSpeakerResponse.parse(await res.json());
    expect(body.talks.map((t) => t.id)).toContain(talk.id);
    const missing = await app.request("/api/search/speakers/spk-nobody");
    expect(missing.status).toBe(404);
    expect(ErrorBody.parse(await missing.json()).error.code).toBe("not_found");
  });

  it("OV-4 bad query params answer 400 with the error shape", async () => {
    const res = await app.request("/api/search/talks?limit=0");
    expect(res.status).toBe(400);
    expect(ErrorBody.parse(await res.json()).error.code).toBe("bad_request");
  });

  it("OV-3 /readyz is 503 while the indexes exist but are empty, and 200 once seeded", async () => {
    const es = new MemoryEs();
    const live = createApp({ store: new EsTalkStore(es) });
    await ensureIndexes(es, { semantic: false });
    expect((await live.request("/readyz")).status).toBe(503);
    await seed(es, data, { semantic: false });
    expect((await live.request("/readyz")).status).toBe(200);
  });

  it("OV-3 /readyz is 503 when the indexes are missing", async () => {
    const res = await createApp({ store: new EsTalkStore(new MemoryEs()) }).request("/readyz");
    expect(res.status).toBe(503);
    expect(ErrorBody.parse(await res.json()).error.code).toBe("not_ready");
  });
});

describe.runIf(process.env.ES_INTEGRATION === "1")("talk search on a local Elasticsearch (ES_INTEGRATION=1)", () => {
  it("SR-3 ebpf talks first with highlights; SR-4 fuzzy security; SR-12 404", async () => {
    const es: EsPort = esPort(clientFromEnv());
    const live = createApp({ store: new EsTalkStore(es) });
    await seed(es, data, { semantic: false });
    const ebpf = SearchTalksResponse.parse(await (await live.request("/api/search/talks?q=ebpf&limit=5")).json()).results;
    for (const r of ebpf) {
      expect(mentions(/ebpf/i)(r.talk)).toBe(true);
      expect(r.highlight).toBeTruthy();
    }
    const sec = SearchTalksResponse.parse(await (await live.request("/api/search/talks?q=kubernets%20security&limit=5")).json()).results;
    for (const r of sec) expect(mentions(/secur/i)(r.talk)).toBe(true);
    expect((await live.request("/api/search/talks/talk-nope")).status).toBe(404);
    expect(await es.count(INDEX.talks)).toBe(data.talks.length);
  }, 60_000);
});
