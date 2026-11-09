// In-memory DocStore with the same semantics as Elasticsearch (versioned writes, term filters).
import { GAME_INDEXES, type GameIndex } from "./indexes";
import {
  AlreadyExistsError,
  DEFAULT_FIND_SIZE,
  type DocStore,
  type Filter,
  type FindOptions,
  type Version,
  type Versioned,
  VersionConflictError,
} from "./store";

type Row = { doc: unknown; seq_no: number };

export function createMemoryStore(): DocStore & { indexes: Set<GameIndex> } {
  const data = new Map<GameIndex, Map<string, Row>>();
  const indexes = new Set<GameIndex>();
  let seq = 0;
  const PRIMARY_TERM = 1;

  const rows = (index: GameIndex) => {
    let m = data.get(index);
    if (!m) data.set(index, (m = new Map()));
    return m;
  };
  // Copy in and out so callers can't mutate stored state, as with a real store.
  const copy = <T>(v: T): T => structuredClone(v);
  const write = (index: GameIndex, id: string, doc: unknown): Version => {
    rows(index).set(id, { doc: copy(doc), seq_no: ++seq });
    return { seq_no: seq, primary_term: PRIMARY_TERM };
  };

  return {
    indexes,
    async ping() {
      return true;
    },
    async ensureIndexes() {
      for (const index of Object.values(GAME_INDEXES)) indexes.add(index);
    },
    async get<T>(index: GameIndex, id: string): Promise<Versioned<T> | null> {
      const row = rows(index).get(id);
      if (!row) return null;
      return { doc: copy(row.doc) as T, version: { seq_no: row.seq_no, primary_term: PRIMARY_TERM } };
    },
    async create<T>(index: GameIndex, id: string, doc: T) {
      if (rows(index).has(id)) throw new AlreadyExistsError(index, id);
      return write(index, id, doc);
    },
    async put<T>(index: GameIndex, id: string, doc: T, ifVersion?: Version) {
      if (ifVersion) {
        const row = rows(index).get(id);
        if (!row || row.seq_no !== ifVersion.seq_no || ifVersion.primary_term !== PRIMARY_TERM) {
          throw new VersionConflictError(index, id);
        }
      }
      return write(index, id, doc);
    },
    async find<T>(index: GameIndex, filter: Filter, opts: FindOptions = {}): Promise<T[]> {
      let docs = [...rows(index).values()].map((r) => r.doc as Record<string, unknown>).filter((d) => matches(d, filter));
      if (opts.afterId) docs = docs.filter((d) => String(d.id) > opts.afterId!);
      if (opts.sort) {
        const { field, order } = opts.sort;
        const dir = order === "asc" ? 1 : -1;
        docs = docs.sort((a, b) => compare(a[field], b[field]) * dir);
      }
      return docs.slice(0, opts.size ?? DEFAULT_FIND_SIZE).map((d) => copy(d) as T);
    },
    async count(index: GameIndex, filter: Filter) {
      return [...rows(index).values()].filter((r) => matches(r.doc as Record<string, unknown>, filter)).length;
    },
  };
}

function matches(doc: Record<string, unknown>, filter: Filter) {
  return Object.entries(filter).every(([field, want]) => {
    const have = doc[field];
    if (want === null) return have === null || have === undefined || (Array.isArray(have) && have.length === 0);
    return Array.isArray(have) ? have.includes(want) : have === want;
  });
}

function compare(a: unknown, b: unknown) {
  if (a === b) return 0;
  if (a === undefined || a === null) return 1;
  if (b === undefined || b === null) return -1;
  return (a as string | number) < (b as string | number) ? -1 : 1;
}
