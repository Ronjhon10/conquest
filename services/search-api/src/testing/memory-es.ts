// In-memory EsPort for unit tests (OV-6). Stores documents by id like Elasticsearch does, so
// re-indexing an id overwrites it. It does not run queries: search logic is tested through
// the query builders and the TalkStore fake.
import type { EsPort, SearchResult } from "../es";

export class MemoryEs implements EsPort {
  readonly indexes = new Map<string, { body: { mappings: object }; docs: Map<string, object> }>();
  readonly requests: { method: string; path: string; body?: object }[] = [];
  bulkCalls = 0;
  /** Scripted answers for raw requests (inference, license, mapping); default 200 {}. */
  respond: (method: string, path: string, body?: object) => { status: number; body: unknown } = () => ({ status: 200, body: {} });

  private idx(index: string) {
    const i = this.indexes.get(index);
    if (!i) throw Object.assign(new Error(`no such index [${index}]`), { meta: { statusCode: 404 } });
    return i;
  }

  async indexExists(index: string) {
    return this.indexes.has(index);
  }
  async createIndex(index: string, body: { mappings: object }) {
    if (!this.indexes.has(index)) this.indexes.set(index, { body, docs: new Map() });
  }
  async bulkIndex(index: string, docs: { id: string; doc: object }[]) {
    this.bulkCalls++;
    const i = this.idx(index);
    for (const { id, doc } of docs) i.docs.set(id, structuredClone(doc));
  }
  async refresh(index: string) {
    this.idx(index);
  }
  async count(index: string) {
    return this.idx(index).docs.size;
  }
  async get<T>(index: string, id: string) {
    return (this.idx(index).docs.get(id) as T | undefined) ?? null;
  }
  async mget<T>(index: string, ids: string[]) {
    const docs = this.idx(index).docs;
    return ids.flatMap((id) => (docs.has(id) ? [docs.get(id) as T] : []));
  }
  async search<T>(_index: string, _body: Record<string, unknown>): Promise<SearchResult<T>> {
    throw new Error("MemoryEs does not run queries; use a TalkStore fake");
  }
  async request(method: "GET" | "PUT" | "POST" | "DELETE", path: string, body?: object) {
    this.requests.push({ method, path, ...(body ? { body } : {}) });
    if (method === "DELETE" && this.indexes.delete(path.replace(/^\//, ""))) return { status: 200, body: {} };
    return this.respond(method, path, body);
  }
}
