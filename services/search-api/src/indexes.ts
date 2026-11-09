// Index mappings for conquest-talks and conquest-speakers (020 Interface, Index mappings).
// Created on service start and before seeding if missing (000: idempotent).
import { INDEX } from "@conquest/contracts";
import type { EsPort } from "./es";

export const CONFERENCE = "kubecon-na-2026";
export const INFERENCE_ID = "conquest-embeddings";

export type IndexOptions = {
  /** Add the `semantic` semantic_text field (needs the conquest-embeddings endpoint, 020 Behavior 2). */
  semantic: boolean;
};

export function talksMapping({ semantic }: IndexOptions) {
  const toSemantic = semantic ? { copy_to: ["semantic"] } : {};
  return {
    dynamic: "strict",
    properties: {
      id: { type: "keyword" },
      conference: { type: "keyword" },
      title: { type: "text", analyzer: "english", fields: { raw: { type: "keyword" } }, ...toSemantic },
      abstract: { type: "text", analyzer: "english", ...toSemantic },
      speaker_ids: { type: "keyword" },
      speaker_names: { type: "text" },
      room: { type: "keyword" },
      starts_at: { type: "date" },
      ends_at: { type: "date" },
      track: { type: "keyword" },
      level: { type: "keyword" },
      // Lowercased so a title-cased goal ("AI Inference + Agentic") matches its tag exactly.
      tags: { type: "keyword", normalizer: "lowercase_keyword", ...toSemantic },
      ...(semantic ? { semantic: { type: "semantic_text", inference_id: INFERENCE_ID } } : {}),
    },
  } as const;
}

/** Analysis only: Elastic Serverless refuses shard/replica settings but accepts these. */
export const talksSettings = {
  analysis: { normalizer: { lowercase_keyword: { type: "custom", filter: ["lowercase"] } } },
} as const;

export const speakersMapping = {
  dynamic: "strict",
  properties: {
    id: { type: "keyword" },
    name: { type: "text", fields: { raw: { type: "keyword" } } },
    company: { type: "keyword" },
    bio: { type: "text" },
    photo_url: { type: "keyword", index: false },
  },
} as const;

/** Create both Search-lane indexes if they don't exist. Never changes an existing index. */
export async function ensureIndexes(es: EsPort, opts: IndexOptions): Promise<{ created: string[] }> {
  const created: string[] = [];
  const wanted = [
    [INDEX.talks, { mappings: talksMapping(opts), settings: talksSettings }],
    [INDEX.speakers, { mappings: speakersMapping }],
  ] as const;
  for (const [index, body] of wanted) {
    if (await es.indexExists(index)) continue;
    await es.createIndex(index, body);
    created.push(index);
  }
  return { created };
}
