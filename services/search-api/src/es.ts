// The slice of Elasticsearch search-api uses, behind a small port so tests can run on an
// in-memory fake (OV-6: tests never call a remote Elasticsearch).
import { Client } from "@elastic/elasticsearch";

export type Hit<T> = { id: string; score: number; source: T; highlight: Record<string, string[]> | null };
export type SearchResult<T> = { hits: Hit<T>[]; total: number; aggregations: Record<string, unknown> | null };

export interface EsPort {
  indexExists(index: string): Promise<boolean>;
  createIndex(index: string, body: { mappings: object; settings?: object }): Promise<void>;
  /** Index (create or overwrite) documents by id. */
  bulkIndex(index: string, docs: { id: string; doc: object }[]): Promise<void>;
  refresh(index: string): Promise<void>;
  count(index: string): Promise<number>;
  get<T>(index: string, id: string): Promise<T | null>;
  mget<T>(index: string, ids: string[]): Promise<T[]>;
  search<T>(index: string, body: Record<string, unknown>): Promise<SearchResult<T>>;
  /** Raw request for the few calls the port doesn't model (inference endpoints, license). */
  request(method: "GET" | "PUT" | "POST" | "DELETE", path: string, body?: object): Promise<{ status: number; body: unknown }>;
}

export function clientFromEnv(env: NodeJS.ProcessEnv = process.env): Client {
  const node = env.ELASTICSEARCH_URL;
  if (!node) throw new Error("ELASTICSEARCH_URL is not set");
  const apiKey = env.ELASTICSEARCH_API_KEY;
  // The client makes its own OTel spans. It must never record request bodies (they hold goal and
  // about text): @elastic/transport's `captureSearchQuery` is off by default and client 9.5 has no
  // option to turn it on. Re-check this if the client is upgraded.
  return new Client({ node, ...(apiKey ? { auth: { apiKey } } : {}) });
}

// Small chunks: with semantic_text each bulk request also embeds its documents.
const BULK_CHUNK = 100;

export function esPort(client: Client): EsPort {
  return {
    indexExists: (index) => client.indices.exists({ index }),
    async createIndex(index, body) {
      try {
        await client.indices.create({ index, ...body });
      } catch (err) {
        // Another replica created it first: fine, creation is idempotent for us.
        if (errorType(err) !== "resource_already_exists_exception") throw err;
      }
    },
    async bulkIndex(index, docs) {
      for (let i = 0; i < docs.length; i += BULK_CHUNK) {
        const chunk = docs.slice(i, i + BULK_CHUNK);
        const res = await client.bulk({ operations: chunk.flatMap(({ id, doc }) => [{ index: { _index: index, _id: id } }, doc]) });
        if (res.errors) {
          const first = res.items.find((it) => it.index?.error)?.index?.error;
          throw new Error(`bulk index into ${index} failed: ${first?.type ?? "unknown"} ${first?.reason ?? ""}`);
        }
      }
    },
    async refresh(index) {
      await client.indices.refresh({ index });
    },
    async count(index) {
      return (await client.count({ index })).count;
    },
    async get<T>(index: string, id: string) {
      try {
        return (await client.get<T>({ index, id }))._source ?? null;
      } catch (err) {
        if (statusOf(err) === 404) return null;
        throw err;
      }
    },
    async mget<T>(index: string, ids: string[]) {
      if (ids.length === 0) return [];
      const res = await client.mget<T>({ index, ids });
      return res.docs.flatMap((d) => ("found" in d && d.found && d._source ? [d._source] : []));
    },
    async search<T>(index: string, body: Record<string, unknown>) {
      const res = await client.search<T>({ index, ...body });
      const total = typeof res.hits.total === "number" ? res.hits.total : (res.hits.total?.value ?? 0);
      return {
        total,
        aggregations: (res.aggregations as Record<string, unknown> | undefined) ?? null,
        hits: res.hits.hits.map((h) => ({
          id: h._id ?? "",
          score: h._score ?? 0,
          source: h._source as T,
          highlight: (h.highlight as Record<string, string[]> | undefined) ?? null,
        })),
      };
    },
    async request(method, path, body) {
      const res = await client.transport.request({ method, path, ...(body ? { body } : {}) }, { meta: true, ignore: [400, 404, 409] });
      return { status: res.statusCode ?? 0, body: res.body };
    },
  };
}

export function statusOf(err: unknown): number | undefined {
  return (err as { meta?: { statusCode?: number } })?.meta?.statusCode;
}

export function errorType(err: unknown): string | undefined {
  return (err as { meta?: { body?: { error?: { type?: string } } } })?.meta?.body?.error?.type;
}
