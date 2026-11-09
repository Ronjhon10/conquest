import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { INDEX } from "@conquest/contracts";
import { parseNdjson } from "@conquest/seed";
import { describe, expect, it } from "vitest";
import { clientFromEnv, esPort } from "./es";
import { ensureIndexes, talksMapping } from "./indexes";
import { fromTalkDoc, seed, toTalkDoc } from "./seed";
import { MemoryEs } from "./testing/memory-es";

const data = parseNdjson(readFileSync(fileURLToPath(new URL("../../../data/kubecon-na-2026.ndjson", import.meta.url)), "utf8"));

describe("index mappings and seed (S.2)", () => {
  it("SR-2 seeding twice leaves the same document count as seeding once", async () => {
    const es = new MemoryEs();
    const once = await seed(es, data, { semantic: false });
    const twice = await seed(es, data, { semantic: false });
    expect(once).toEqual({ talks: data.talks.length, speakers: data.speakers.length });
    expect(twice).toEqual(once);
  });

  it("SR-2 indexes are created once and an existing index is left alone", async () => {
    const es = new MemoryEs();
    expect((await ensureIndexes(es, { semantic: false })).created).toEqual([INDEX.talks, INDEX.speakers]);
    expect((await ensureIndexes(es, { semantic: true })).created).toEqual([]);
    expect(JSON.stringify(es.indexes.get(INDEX.talks)!.body)).not.toContain("semantic_text");
  });

  it("SR-13 tags are matched case-insensitively, so a title-cased goal hits its lowercase tag", async () => {
    const es = new MemoryEs();
    await ensureIndexes(es, { semantic: false });
    const body = es.indexes.get(INDEX.talks)!.body as { mappings: { properties: { tags: object } }; settings: object };
    expect(body.mappings.properties.tags).toMatchObject({ type: "keyword", normalizer: "lowercase_keyword" });
    expect(body.settings).toEqual({ analysis: { normalizer: { lowercase_keyword: { type: "custom", filter: ["lowercase"] } } } });
  });

  it("SR-11 without embeddings the talks mapping has no semantic field; with them, title/abstract/tags copy into it", () => {
    const plain = talksMapping({ semantic: false }).properties;
    expect("semantic" in plain).toBe(false);
    expect(JSON.stringify(plain)).not.toContain("copy_to");
    const sem = talksMapping({ semantic: true }).properties as Record<string, { copy_to?: string[]; type?: string; inference_id?: string }>;
    expect(sem.semantic).toEqual({ type: "semantic_text", inference_id: "conquest-embeddings" });
    for (const f of ["title", "abstract", "tags"]) expect(sem[f]!.copy_to).toEqual(["semantic"]);
  });

  it("SR-2 talk documents carry conference and speaker names, and strip back to the contract Talk", () => {
    const byId = new Map(data.speakers.map((s) => [s.id, s]));
    const talk = data.talks[0]!;
    const doc = toTalkDoc(talk, byId);
    expect(doc.conference).toBe("kubecon-na-2026");
    expect(doc.speaker_names).toEqual(talk.speaker_ids.map((id) => byId.get(id)!.name));
    expect(fromTalkDoc(doc)).toEqual(talk);
  });
});

describe.runIf(process.env.ES_INTEGRATION === "1")("seed against a local Elasticsearch (ES_INTEGRATION=1)", () => {
  it("SR-2 seeding twice leaves the same document count", async () => {
    const es = esPort(clientFromEnv());
    const once = await seed(es, data, { semantic: false });
    const twice = await seed(es, data, { semantic: false });
    expect(twice).toEqual(once);
    expect(once.talks).toBe(data.talks.length);
  }, 60_000);
});
