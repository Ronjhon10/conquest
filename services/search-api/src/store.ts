// TalkStore: everything the routes need from the talk and speaker indexes. EsTalkStore is the
// real one; MemoryTalkStore (testing/memory-store.ts) is the fake for tests and for running
// search-api locally without Elasticsearch.
import { INDEX, type Speaker, type Talk } from "@conquest/contracts";
import type { EsPort } from "./es";
import { searchTalksBody, talksBySpeakerBody, type SearchOptions } from "./queries";
import { fromTalkDoc, type TalkDoc } from "./seed";
import { facetsFromResult, suggestBody, type Facets } from "./suggest";

export type TalkHit = { talk: Talk; score: number; highlight: string | null };

export interface TalkStore {
  searchTalks(q: string, limit: number, offset?: number): Promise<TalkHit[]>;
  rooms(): Promise<string[]>;
  getTalk(id: string): Promise<Talk | null>;
  getSpeakers(ids: string[]): Promise<Speaker[]>;
  getSpeaker(id: string): Promise<Speaker | null>;
  talksBySpeaker(id: string): Promise<Talk[]>;
  /** Tag and track counts over the top 50 BM25 matches for `about`, plus index-wide tag counts. */
  facets(about: string): Promise<Facets>;
  /** Readiness: the backing indexes answer and hold the seeded schedule. */
  ready(): Promise<boolean>;
}

/** How often a store in BM25 mode re-checks whether semantic search has become available. */
export const REDETECT_MS = 60_000;

export class EsTalkStore implements TalkStore {
  private lastCheck = 0;
  private checking: Promise<void> | null = null;

  /**
   * `redetect`: when given and search is BM25 only, re-checked at most every REDETECT_MS in the
   * background, so a reseed with embeddings turns semantic search on without a restart.
   */
  constructor(
    private readonly es: EsPort,
    private opts: SearchOptions = { semantic: false, rrf: false },
    private readonly redetect?: () => Promise<SearchOptions>,
    private readonly now: () => number = Date.now,
  ) {
    this.lastCheck = this.now();
  }

  /** Background re-check; never blocks or fails a search. Exposed for tests. */
  maybeRedetect(): Promise<void> | null {
    if (!this.redetect || this.opts.semantic || this.checking || this.now() - this.lastCheck < REDETECT_MS) return this.checking;
    this.lastCheck = this.now();
    this.checking = this.redetect()
      .then((next) => {
        if (next.semantic) {
          this.opts = next;
          console.log(JSON.stringify({ level: "info", msg: "semantic search is now available", ...next }));
        }
      })
      .catch(() => undefined)
      .finally(() => {
        this.checking = null;
      });
    return this.checking;
  }

  get options(): SearchOptions {
    return this.opts;
  }

  async searchTalks(q: string, limit: number, offset = 0): Promise<TalkHit[]> {
    void this.maybeRedetect();
    const res = await this.searchWithFallback(q, limit, offset);
    return res.hits.map((h) => ({ talk: fromTalkDoc(h.source), score: h.score, highlight: h.highlight?.abstract?.[0] ?? null }));
  }

  /** RRF refusal falls back to bool; an inference outage falls back to BM25 until re-detection. */
  private async searchWithFallback(q: string, limit: number, offset: number) {
    for (;;) {
      // Each in-flight query remembers its mode, even if another query disables semantic search.
      const attempted = { ...this.opts };
      try {
        return await this.es.search<TalkDoc>(INDEX.talks, searchTalksBody(q, limit, attempted, offset));
      } catch (err) {
        if (attempted.semantic && isInferenceFailure(err)) {
          this.opts = { semantic: false, rrf: false };
          this.lastCheck = this.now();
          console.warn(JSON.stringify({ level: "warn", msg: "inference unavailable; using BM25" }));
        } else if (attempted.rrf && isRrfRefusal(err)) {
          this.opts = { ...this.opts, rrf: false };
          console.warn(JSON.stringify({ level: "warn", msg: "rrf retriever refused; using bool.should" }));
        } else {
          throw err;
        }
      }
    }
  }

  async rooms(): Promise<string[]> {
    const rooms: string[] = [];
    let after: { room: string } | undefined;
    for (;;) {
      // Composite aggregation pages over every room, regardless of the talk hit limit.
      const result = await this.es.search<never>(INDEX.talks, { size: 0, aggs: { rooms: { composite: {
        size: 100, sources: [{ room: { terms: { field: "room" } } }], ...(after ? { after } : {}),
      } } } });
      const page = result.aggregations?.rooms as {
        buckets: { key: { room: string } }[]; after_key?: { room: string };
      } | undefined;
      if (!page?.buckets.length) break;
      rooms.push(...page.buckets.map((b) => b.key.room));
      if (!page.after_key) break;
      after = page.after_key;
    }
    return rooms;
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
  async facets(about: string) {
    const res = await this.es.search<Pick<TalkDoc, "tags" | "track">>(INDEX.talks, suggestBody(about));
    return facetsFromResult(res.hits.map((h) => h.source), res.aggregations);
  }
  async ready() {
    try {
      // Exists is not enough: a fresh deploy before the Seed Job runs would serve zero talks.
      for (const index of [INDEX.talks, INDEX.speakers]) if (!(await this.es.indexExists(index)) || (await this.es.count(index)) === 0) return false;
      return true;
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

function isInferenceFailure(err: unknown): boolean {
  const meta = (err as { meta?: { statusCode?: number; body?: unknown } })?.meta;
  return [400, 401, 403, 404, 429, 500, 502, 503, 504].includes(meta?.statusCode ?? 0)
    && /inference|openai|model_not_found_exception/i.test(JSON.stringify(meta?.body ?? {}));
}
