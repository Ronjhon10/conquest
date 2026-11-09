import { fixtures } from "@conquest/contracts";
import { expect, it } from "vitest";
import { buildMap } from "../../game-api/src/attendees/map";
import { memoryDeps } from "../../game-api/src/deps";
import { createFakeSearchClient } from "../../game-api/src/search/client";
import { EsTalkStore } from "./store";
import { MemoryEs } from "./testing/memory-es";
import { MemoryTalkStore } from "./testing/memory-store";
import { createApp } from "./app";
import { createHttpSearchClient } from "../../game-api/src/search/client";

it("GM-5 backfill searches later schedule pages when the first 100 talks clash", async () => {
  const talk = fixtures.talks[0]!;
  const schedule = Array.from({ length: 104 }, (_, i) => {
    const slot = i < 100 ? 0 : i - 99;
    return { ...talk, id: `schedule-${i}`, starts_at: new Date(Date.UTC(2026, 10, 10, 9 + slot)).toISOString(), ends_at: new Date(Date.UTC(2026, 10, 10, 10 + slot)).toISOString() };
  });
  const app = createApp({ store: new MemoryTalkStore({ talks: schedule, speakers: fixtures.speakers }) });
  const search = createHttpSearchClient("http://search", async (url, init) => app.request(url, init));
  expect(await createFakeSearchClient(schedule, fixtures.speakers).searchTalks("", 100, 100)).toHaveLength(4);
  const { map } = await buildMap(memoryDeps({ search }), [], "");
  expect(map).toHaveLength(5);
  expect(new Set(map.map((b) => b.talk_id)).size).toBe(5);
});

it("OV-5 inference outages fall back to keyword results and can later recover semantic search", async () => {
  const es = new MemoryEs(); let failed = true; let now = 0;
  const bodies: Record<string, unknown>[] = [];
  es.search = async <T,>(_index: string, body: Record<string, unknown>) => {
    bodies.push(body);
    if (failed && JSON.stringify(body).includes('"semantic"')) {
      throw Object.assign(new Error("inference failure"), { meta: { statusCode: 503, body: { error: { type: "inference_exception", reason: "OpenAI service unavailable" } } } });
    }
    return { hits: [{ id: "talk-1", source: fixtures.talks[0] as T, score: 1, highlight: null }], total: 1, aggregations: null };
  };
  const store = new EsTalkStore(es, { semantic: true, rrf: true }, async () => ({ semantic: true, rrf: true }), () => now);
  const results = await Promise.all([store.searchTalks("platform", 5), store.searchTalks("security", 5)]);
  expect(results.map((r) => r.length)).toEqual([1, 1]);
  expect(store.options).toEqual({ semantic: false, rrf: false });
  expect(bodies.at(-1)).toMatchObject({ query: { multi_match: {} } });
  failed = false; now = 61_000;
  await store.maybeRedetect();
  await store.searchTalks("platform", 5);
  expect(store.options.semantic).toBe(true);
  expect(bodies.at(-1)).toHaveProperty("retriever");
});

it("OV-2 schedule pages preserve empty-query ordering and reject invalid pagination", async () => {
  const store = new MemoryTalkStore({ talks: fixtures.talks, speakers: fixtures.speakers });
  const app = createApp({ store });
  const response = await app.request("/api/search/talks?limit=2&offset=2");
  expect(response.status).toBe(200);
  const body = await response.json() as { results: { talk: { id: string } }[] };
  expect(body.results.map((r) => r.talk.id)).toEqual(["talk-6", "talk-3"]);
  for (const query of ["offset=-1", "offset=10000", "q=security&offset=2"]) {
    expect((await app.request(`/api/search/talks?${query}`)).status).toBe(400);
  }
});

it("GM-5 Elasticsearch schedule pagination sends from with a stable time/id sort", async () => {
  const es = new MemoryEs(); let body: Record<string, unknown> = {};
  es.search = async <T,>(_index: string, request: Record<string, unknown>) => {
    body = request; return { hits: [] as { id: string; score: number; source: T; highlight: null }[], total: 0, aggregations: null };
  };
  await new EsTalkStore(es).searchTalks("", 100, 100);
  expect(body).toMatchObject({ from: 100, size: 100, query: { match_all: {} }, sort: [{ starts_at: "asc" }, { id: "asc" }] });
});
