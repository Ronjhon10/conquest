import { fixtures } from "@conquest/contracts";
import { describe, expect, it } from "vitest";
import { createFakeSearchClient, createHttpSearchClient, SearchApiError } from "./client";

const byId = new Map(fixtures.talks.map((t) => [t.id, t]));

describe("fake search client", () => {
  const search = createFakeSearchClient();

  it("rank keeps the 020 shape: limit, no clashes, start-time order, reasons", async () => {
    const bosses = await search.rank({ goals: ["Observability", "Security"], about: "I run platforms", limit: 4 });
    expect(bosses.length).toBeGreaterThan(0);
    expect(bosses.length).toBeLessThanOrEqual(4);
    const talks = bosses.map((b) => byId.get(b.talk_id)!);
    for (let i = 1; i < talks.length; i++) {
      const [prev, cur] = [talks[i - 1]!, talks[i]!];
      expect(prev.starts_at <= cur.starts_at).toBe(true);
      expect(prev.ends_at <= cur.starts_at).toBe(true);
    }
    for (const b of bosses) expect(b.reason).toMatch(/^(Matches your goal "(Observability|Security)"|Fits your background)$/);
  });

  it("rank is deterministic", async () => {
    const req = { goals: ["Platform engineering"], about: "kubernetes", limit: 6 };
    expect(await search.rank(req)).toEqual(await search.rank(req));
  });

  it("getTalk returns the talk with its speakers, or null", async () => {
    const r = await search.getTalk("talk-4");
    expect(r!.speakers.map((s) => s.id)).toEqual(["spk-lin", "spk-ada"]);
    expect(await search.getTalk("nope")).toBeNull();
  });

  it("suggestGoals returns 3-6 distinct phrases", async () => {
    const goals = await search.suggestGoals("I do observability with eBPF");
    expect(goals.length).toBeGreaterThanOrEqual(3);
    expect(goals.length).toBeLessThanOrEqual(6);
    expect(new Set(goals).size).toBe(goals.length);
  });

  it("searchTalks with an empty query lists every talk (for rooms)", async () => {
    expect((await search.searchTalks("", 100)).length).toBe(fixtures.talks.length);
  });
});

describe("HTTP search client", () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fakeFetch = (status: number, json: unknown) =>
    (async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify(json), { status });
    }) as typeof fetch;

  it("calls search-api routes and parses the contracts responses", async () => {
    const bosses = fixtures.attendee.map;
    const client = createHttpSearchClient("http://search:8080/", fakeFetch(200, { bosses }));
    expect(await client.rank({ goals: ["x"], about: "y", limit: 6 })).toEqual(bosses);
    expect(calls.at(-1)!.url).toBe("http://search:8080/api/search/rank");
    expect(calls.at(-1)!.init!.method).toBe("POST");
  });

  it("404 on a talk is null; other errors throw", async () => {
    expect(await createHttpSearchClient("http://s", fakeFetch(404, {})).getTalk("x")).toBeNull();
    await expect(createHttpSearchClient("http://s", fakeFetch(500, {})).getTalk("x")).rejects.toBeInstanceOf(SearchApiError);
  });
});
