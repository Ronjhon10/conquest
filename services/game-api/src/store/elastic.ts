// DocStore on Elasticsearch (000: the only datastore). Writes use refresh "wait_for" so reads,
// the leaderboard and the report see them right away (030 Behavior 13).
import { Client, errors, type estypes } from "@elastic/elasticsearch";
import { MAPPINGS, GAME_INDEXES, XP_JOURNAL_MAPPING, type GameIndex } from "./indexes";
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

/** Client from ELASTICSEARCH_URL / ELASTICSEARCH_API_KEY (000 Environment), or null if unset. */
export function esClientFromEnv(env: NodeJS.ProcessEnv = process.env): Client | null {
  if (!env.ELASTICSEARCH_URL) return null;
  return new Client({
    node: env.ELASTICSEARCH_URL,
    ...(env.ELASTICSEARCH_API_KEY ? { auth: { apiKey: env.ELASTICSEARCH_API_KEY } } : {}),
  });
}

export function createElasticStore(es: Client): DocStore {
  const version = (r: { _seq_no?: number; _primary_term?: number }): Version => ({
    seq_no: r._seq_no ?? 0,
    primary_term: r._primary_term ?? 0,
  });

  return {
    async ping() {
      try {
        return await es.ping();
      } catch {
        return false;
      }
    },

    async ensureIndexes() {
      for (const [index, mappings] of Object.entries(MAPPINGS)) {
        if (await es.indices.exists({ index })) {
          if (index === GAME_INDEXES.attendees) await es.indices.putMapping({ index, properties: XP_JOURNAL_MAPPING });
          continue;
        }
        try {
          await es.indices.create({ index, mappings });
        } catch (err) {
          // Another replica created it first: that's fine, it's the same mapping.
          if (!(err instanceof errors.ResponseError && err.body?.error?.type === "resource_already_exists_exception")) throw err;
        }
      }
    },

    async get<T>(index: GameIndex, id: string): Promise<Versioned<T> | null> {
      try {
        const r = await es.get<T>({ index, id });
        if (!r.found || r._source === undefined) return null;
        return { doc: r._source, version: version(r) };
      } catch (err) {
        if (err instanceof errors.ResponseError && err.statusCode === 404) return null;
        throw err;
      }
    },

    async create<T>(index: GameIndex, id: string, doc: T) {
      try {
        return version(await es.create({ index, id, document: doc, refresh: "wait_for" }));
      } catch (err) {
        if (err instanceof errors.ResponseError && err.statusCode === 409) throw new AlreadyExistsError(index, id);
        throw err;
      }
    },

    async put<T>(index: GameIndex, id: string, doc: T, ifVersion?: Version) {
      try {
        const r = await es.index({
          index,
          id,
          document: doc,
          refresh: "wait_for",
          ...(ifVersion ? { if_seq_no: ifVersion.seq_no, if_primary_term: ifVersion.primary_term } : {}),
        });
        return version(r);
      } catch (err) {
        if (ifVersion && err instanceof errors.ResponseError && err.statusCode === 409) throw new VersionConflictError(index, id);
        throw err;
      }
    },

    async find<T>(index: GameIndex, filter: Filter, opts: FindOptions = {}): Promise<T[]> {
      const r = await es.search<T>({
        index,
        query: toQuery(filter),
        size: opts.size ?? DEFAULT_FIND_SIZE,
        ...(opts.sort ? { sort: [{ [opts.sort.field]: { order: opts.sort.order } }] } : {}),
      });
      return r.hits.hits.flatMap((h) => (h._source === undefined ? [] : [h._source]));
    },

    async count(index: GameIndex, filter: Filter) {
      return (await es.count({ index, query: toQuery(filter) })).count;
    },
  };
}

export function toQuery(filter: Filter): estypes.QueryDslQueryContainer {
  const must: estypes.QueryDslQueryContainer[] = [];
  const mustNot: estypes.QueryDslQueryContainer[] = [];
  for (const [field, value] of Object.entries(filter)) {
    if (value === null) mustNot.push({ exists: { field } });
    else must.push({ term: { [field]: value } });
  }
  if (must.length === 0 && mustNot.length === 0) return { match_all: {} };
  return { bool: { filter: must, must_not: mustNot } };
}
