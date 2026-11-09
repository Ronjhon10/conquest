// TalkStore: everything the routes need from the talk and speaker indexes. EsTalkStore is the
// real one; MemoryTalkStore (testing/memory-store.ts) is the fake for tests and for running
// search-api locally without Elasticsearch.
import { INDEX, type Speaker, type Talk } from "@conquest/contracts";
import type { EsPort } from "./es";
import { searchTalksBody, talksBySpeakerBody, type SearchOptions } from "./queries";
import { fromTalkDoc, type TalkDoc } from "./seed";

export type TalkHit = { talk: Talk; score: number; highlight: string | null };

export interface TalkStore {
  searchTalks(q: string, limit: number): Promise<TalkHit[]>;
  getTalk(id: string): Promise<Talk | null>;
  getSpeakers(ids: string[]): Promise<Speaker[]>;
  getSpeaker(id: string): Promise<Speaker | null>;
  talksBySpeaker(id: string): Promise<Talk[]>;
  /** Readiness: the backing indexes answer. */
  ready(): Promise<boolean>;
}

export class EsTalkStore implements TalkStore {
  constructor(
    private readonly es: EsPort,
    private opts: SearchOptions = { semantic: false, rrf: false },
  ) {}

  get options(): SearchOptions {
    return this.opts;
  }

  async searchTalks(q: string, limit: number): Promise<TalkHit[]> {
    const res = await this.searchWithFallback(q, limit);
    return res.hits.map((h) => ({ talk: fromTalkDoc(h.source), score: h.score, highlight: h.highlight?.abstract?.[0] ?? null }));
  }

  /** If the cluster refuses the rrf retriever, switch to bool.should for good (020 Behavior 3). */
  private async searchWithFallback(q: string, limit: number) {
    try {
      return await this.es.search<TalkDoc>(INDEX.talks, searchTalksBody(q, limit, this.opts));
    } catch (err) {
      if (!this.opts.rrf || !isRrfRefusal(err)) throw err;
      this.opts = { ...this.opts, rrf: false };
      console.warn(JSON.stringify({ level: "warn", msg: "rrf retriever refused; using bool.should" }));
      return this.es.search<TalkDoc>(INDEX.talks, searchTalksBody(q, limit, this.opts));
    }
  }

  async getTalk(id: string) {
    const doc = await this.es.get<TalkDoc>(INDEX.talks, id);
    return doc ? fromTalkDoc(doc) : null;
  }
  getSpeakers(ids: string[]) {
    return this.es.mget<Speaker>(INDEX.speakers, ids);
  }
  getSpeaker(id: string) {
    return this.es.get<Speaker>(INDEX.speakers, id);
  }
  async talksBySpeaker(id: string) {
    const res = await this.es.search<TalkDoc>(INDEX.talks, talksBySpeakerBody(id));
    return res.hits.map((h) => fromTalkDoc(h.source));
  }
  async ready() {
    try {
      return (await this.es.indexExists(INDEX.talks)) && (await this.es.indexExists(INDEX.speakers));
    } catch {
      return false;
    }
  }
}

function isRrfRefusal(err: unknown): boolean {
  const e = err as { meta?: { statusCode?: number; body?: unknown } };
  const status = e?.meta?.statusCode;
  const text = JSON.stringify(e?.meta?.body ?? (err instanceof Error ? err.message : "")).toLowerCase();
  return (status === 400 || status === 403) && (text.includes("rrf") || text.includes("retriever") || text.includes("license"));
}
