// The storage seam: everything game-api keeps goes through a DocStore. Elasticsearch in the
// service, an in-memory store in tests (000 OV-6: unit tests never call a remote Elasticsearch).
import type { GameIndex } from "./indexes";

export type Version = { seq_no: number; primary_term: number };
export type Versioned<T> = { doc: T; version: Version };

/** Exact-match filters, ANDed. A value matches an array field if any element equals it; null matches a missing/null field. */
export type Filter = Record<string, string | number | boolean | null>;
export type FindOptions = { size?: number; sort?: { field: string; order: "asc" | "desc" } };

export interface DocStore {
  /** True when the backing store answers (used by /readyz). */
  ping(): Promise<boolean>;
  /** Creates any missing Game index with its mapping. Safe to call on every start. */
  ensureIndexes(): Promise<void>;
  get<T>(index: GameIndex, id: string): Promise<Versioned<T> | null>;
  /** Throws AlreadyExistsError if the id is taken. */
  create<T>(index: GameIndex, id: string, doc: T): Promise<Version>;
  /** Overwrites the doc. With `ifVersion`, throws VersionConflictError if it changed since it was read. */
  put<T>(index: GameIndex, id: string, doc: T, ifVersion?: Version): Promise<Version>;
  find<T>(index: GameIndex, filter: Filter, opts?: FindOptions): Promise<T[]>;
  count(index: GameIndex, filter: Filter): Promise<number>;
}

export class AlreadyExistsError extends Error {
  constructor(index: string, id: string) {
    super(`${index}/${id} already exists`);
  }
}

export class VersionConflictError extends Error {
  constructor(index: string, id: string) {
    super(`${index}/${id} changed since it was read`);
  }
}

/** Default page size for find; enough for one conference's game state in the demo. */
export const DEFAULT_FIND_SIZE = 1000;
