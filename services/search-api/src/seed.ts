// Bulk-index the committed schedule (020 Interface: same IDs overwrite, so seeding is idempotent, SR-2).
import { INDEX, type Speaker, Talk } from "@conquest/contracts";
import type { EsPort } from "./es";
import { CONFERENCE, ensureIndexes, type IndexOptions } from "./indexes";

/** What a talk looks like in conquest-talks: the contract Talk plus search-only fields. */
export type TalkDoc = Talk & { conference: string; speaker_names: string[] };

export function toTalkDoc(talk: Talk, speakers: Map<string, Speaker>): TalkDoc {
  return {
    ...talk,
    conference: CONFERENCE,
    speaker_names: talk.speaker_ids.flatMap((id) => {
      const s = speakers.get(id);
      return s ? [s.name] : [];
    }),
  };
}

/** Strip the search-only fields back off (API responses are contract Talks). */
export function fromTalkDoc(doc: TalkDoc): Talk {
  return Talk.parse(doc); // zod objects drop unknown keys
}

export async function seed(
  es: EsPort,
  data: { talks: Talk[]; speakers: Speaker[] },
  opts: IndexOptions,
): Promise<{ talks: number; speakers: number }> {
  await ensureIndexes(es, opts);
  const byId = new Map(data.speakers.map((s) => [s.id, s]));
  await es.bulkIndex(INDEX.speakers, data.speakers.map((s) => ({ id: s.id, doc: s })));
  await es.bulkIndex(INDEX.talks, data.talks.map((t) => ({ id: t.id, doc: toTalkDoc(t, byId) })));
  await es.refresh(INDEX.speakers);
  await es.refresh(INDEX.talks);
  return { talks: await es.count(INDEX.talks), speakers: await es.count(INDEX.speakers) };
}
