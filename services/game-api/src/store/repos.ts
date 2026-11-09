// Typed repositories over a DocStore, one per Game index. Every read is checked against the
// contracts schema, so a bad document fails loudly here instead of leaking to the web.
import { Attendee, CoinGift, Conference, Party, XpEvent } from "@conquest/contracts";
import type { z } from "zod";
import { GAME_INDEXES, type GameIndex } from "./indexes";
import { type DocStore, type Filter, type FindOptions, type Version, type Versioned, VersionConflictError } from "./store";

/** 030 Behavior 13: optimistic-concurrency updates retry up to 3 times. */
export const UPDATE_RETRIES = 3;

export type Repo<T extends { id: string }> = {
  get(id: string): Promise<T | null>;
  getVersioned(id: string): Promise<Versioned<T> | null>;
  create(doc: T): Promise<T>;
  /** Overwrite; pass the version you read to guard against lost updates. */
  put(doc: T, ifVersion?: Version): Promise<T>;
  /**
   * Read, apply `change`, write with if_seq_no/if_primary_term; on conflict re-read and retry
   * (up to UPDATE_RETRIES retries). Returns null if the doc doesn't exist.
   */
  update(id: string, change: (doc: T) => T): Promise<T | null>;
  find(filter?: Filter, opts?: FindOptions): Promise<T[]>;
  count(filter?: Filter): Promise<number>;
};

function repo<S extends z.ZodType<{ id: string }>>(store: DocStore, index: GameIndex, schema: S): Repo<z.infer<S>> {
  type T = z.infer<S>;
  const check = (doc: unknown): T => schema.parse(doc);

  return {
    async get(id) {
      const r = await store.get<T>(index, id);
      return r ? check(r.doc) : null;
    },
    async getVersioned(id) {
      const r = await store.get<T>(index, id);
      return r ? { doc: check(r.doc), version: r.version } : null;
    },
    async create(doc) {
      const valid = check(doc);
      await store.create(index, valid.id, valid);
      return valid;
    },
    async put(doc, ifVersion) {
      const valid = check(doc);
      await store.put(index, valid.id, valid, ifVersion);
      return valid;
    },
    async update(id, change) {
      for (let attempt = 0; ; attempt++) {
        const current = await store.get<T>(index, id);
        if (!current) return null;
        const next = check(change(check(current.doc)));
        try {
          await store.put(index, id, next, current.version);
          return next;
        } catch (err) {
          if (!(err instanceof VersionConflictError) || attempt >= UPDATE_RETRIES) throw err;
        }
      }
    },
    async find(filter = {}, opts) {
      return (await store.find<T>(index, filter, opts)).map(check);
    },
    async count(filter = {}) {
      return store.count(index, filter);
    },
  };
}

export function createRepos(store: DocStore) {
  return {
    conferences: repo(store, GAME_INDEXES.conferences, Conference),
    attendees: repo(store, GAME_INDEXES.attendees, Attendee),
    xpEvents: repo(store, GAME_INDEXES.xpEvents, XpEvent),
    parties: repo(store, GAME_INDEXES.parties, Party),
    coins: repo(store, GAME_INDEXES.coins, CoinGift),
  };
}
export type Repos = ReturnType<typeof createRepos>;
