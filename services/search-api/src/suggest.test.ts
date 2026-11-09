import { ErrorBody, SuggestGoalsResponse } from "@conquest/contracts";
import { describe, expect, it } from "vitest";
import { createApp } from "./app";
import { loadSchedule } from "./data";
import { EsTalkStore } from "./store";
import { facetsFromResult, NOT_GOALS, pickGoals, suggestBody, titleCase, type Facets } from "./suggest";
import { MemoryEs } from "./testing/memory-es";
import { MemoryTalkStore } from "./testing/memory-store";

const data = await loadSchedule();
const app = createApp({ store: new MemoryTalkStore(data) });

async function suggest(about: string) {
  const res = await app.request("/api/search/suggest-goals", { method: "POST", body: JSON.stringify({ about }), headers: { "content-type": "application/json" } });
  expect(res.status).toBe(200);
  return SuggestGoalsResponse.parse(await res.json()).goals;
}

/** Share of talks carrying each lowercased tag. */
const share = new Map<string, number>();
for (const t of data.talks) for (const tag of new Set(t.tags)) share.set(tag, (share.get(tag) ?? 0) + 1);
for (const [k, v] of share) share.set(k, v / data.talks.length);

const abouts = [
  "SRE at a bank running hundreds of Kubernetes clusters; I care about security, policy and supply chain.",
  "ML engineer serving LLMs on GPUs, interested in inference autoscaling and agents.",
  "Frontend developer, new to cloud native.",
  "",
  "zzzz qqqq",
];

describe("POST /suggest-goals (S.6)", () => {
  it("SR-10 returns 3-6 distinct phrases, none a tag on more than 60% of talks", async () => {
    for (const about of abouts) {
      const goals = await suggest(about);
      expect(goals.length, about).toBeGreaterThanOrEqual(3);
      expect(goals.length, about).toBeLessThanOrEqual(6);
      expect(new Set(goals.map((g) => g.toLowerCase())).size).toBe(goals.length);
      for (const g of goals) {
        expect(share.get(g.toLowerCase()) ?? 0, g).toBeLessThanOrEqual(0.6);
        expect(NOT_GOALS.has(g.toLowerCase()), g).toBe(false);
      }
    }
  });

  it("SR-10 phrases follow the about text", async () => {
    const sec = (await suggest(abouts[0]!)).join(" ").toLowerCase();
    expect(sec).toContain("security");
    const ai = (await suggest(abouts[1]!)).join(" ").toLowerCase();
    expect(ai).toMatch(/ai|inference|gpu|llm/);
  });

  it("SR-10 a tag on more than 60% of talks is never suggested, even when it tops the sample", () => {
    const f: Facets = {
      sample: { tags: [{ term: "kubernetes", count: 50 }, { term: "security", count: 20 }, { term: "falco", count: 9 }, { term: "opa", count: 4 }], tracks: [{ term: "Security", count: 20 }] },
      all: { docs: 100, tags: [{ term: "kubernetes", count: 61 }, { term: "security", count: 30 }, { term: "falco", count: 9 }, { term: "opa", count: 4 }] },
    };
    expect(pickGoals(f)).toEqual(["Security", "Falco", "OPA"]);
  });

  it("SR-10 a thin sample is topped up to 3 from the most common usable tags; formats are skipped", () => {
    const f: Facets = {
      sample: { tags: [{ term: "keynote sessions", count: 5 }, { term: "ebpf", count: 2 }], tracks: [] },
      all: { docs: 10, tags: [{ term: "observability", count: 4 }, { term: "keynote sessions", count: 3 }, { term: "ai inference + agentic", count: 3 }, { term: "ebpf", count: 2 }] },
    };
    expect(pickGoals(f)).toEqual(["eBPF", "Observability", "AI Inference + Agentic"]);
  });

  it("SR-10 at most 6 phrases", () => {
    const tags = Array.from({ length: 12 }, (_, i) => ({ term: `topic${i}`, count: 20 - i }));
    expect(pickGoals({ sample: { tags, tracks: [] }, all: { docs: 100, tags } })).toHaveLength(6);
  });

  it("SR-10 title-casing keeps acronyms and project names", () => {
    expect(titleCase("ai inference + agentic")).toBe("AI Inference + Agentic");
    expect(titleCase("ebpf")).toBe("eBPF");
    expect(titleCase("data processing + storage")).toBe("Data Processing + Storage");
    expect(titleCase("opentelemetry")).toBe("OpenTelemetry");
  });

  it("SR-10 the Elasticsearch request takes exactly the top 50 BM25 hits (no per-shard sampler) and counts tags index-wide in one call", async () => {
    const body = suggestBody("platform teams");
    expect(body.query).toHaveProperty("multi_match");
    expect(body.size).toBe(50);
    expect(body._source).toEqual(["tags", "track"]);
    expect(JSON.stringify(body)).not.toContain("sampler");
    expect(body.aggs.all.global).toEqual({});
    expect(suggestBody("  ")).toMatchObject({ size: 0, query: { match_none: {} } });

    const es = new MemoryEs();
    const seen: unknown[] = [];
    es.search = async (_i, b) => {
      seen.push(b);
      const hit = (tags: string[], track: string) => ({ id: "t", score: 1, highlight: null, source: { tags, track } });
      return {
        hits: [hit(["security", "falco", "security"], "Security"), hit(["security"], "Security"), hit(["opa"], "Security")],
        total: 3,
        aggregations: { all: { doc_count: 480, tags: { buckets: [{ key: "security", doc_count: 40 }] } } },
      } as never;
    };
    expect(await new EsTalkStore(es).facets("x")).toEqual({
      sample: { tags: [{ term: "security", count: 2 }, { term: "falco", count: 1 }, { term: "opa", count: 1 }], tracks: [{ term: "Security", count: 3 }] },
      all: { docs: 480, tags: [{ term: "security", count: 40 }] },
    });
    expect(seen).toHaveLength(1);
    expect(facetsFromResult([], null)).toEqual({ sample: { tags: [], tracks: [] }, all: { docs: 0, tags: [] } });
  });

  it("OV-4 a body without about is a 400 with the error shape", async () => {
    const res = await app.request("/api/search/suggest-goals", { method: "POST", body: "{}", headers: { "content-type": "application/json" } });
    expect(res.status).toBe(400);
    expect(ErrorBody.parse(await res.json()).error.code).toBe("bad_request");
  });
});
