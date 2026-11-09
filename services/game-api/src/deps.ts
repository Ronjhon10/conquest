// What every route needs, built once. Tests pass in-memory pieces; the service builds them from env.
import { createHttpSearchClient, createFakeSearchClient, type SearchClient } from "./search/client";
import { createElasticStore, esClientFromEnv } from "./store/elastic";
import { createMemoryStore } from "./store/memory";
import { createRepos, type Repos } from "./store/repos";
import type { DocStore } from "./store/store";

export type Deps = { store: DocStore; repos: Repos; search: SearchClient };

export function memoryDeps(search: SearchClient = createFakeSearchClient()): Deps {
  const store = createMemoryStore();
  return { store, repos: createRepos(store), search };
}

/**
 * ELASTICSEARCH_URL unset → in-memory store (local dev only; state is lost on restart).
 * FAKE_SEARCH=1 or SEARCH_API_URL unset → fixture search client, so game-api runs before search-api lands.
 */
export function depsFromEnv(env: NodeJS.ProcessEnv = process.env): Deps & { notes: string[] } {
  const notes: string[] = [];
  const es = esClientFromEnv(env);
  const store = es ? createElasticStore(es) : createMemoryStore();
  if (!es) notes.push("ELASTICSEARCH_URL unset: using in-memory store");

  const useFake = env.FAKE_SEARCH === "1" || !env.SEARCH_API_URL;
  const search = useFake ? createFakeSearchClient() : createHttpSearchClient(env.SEARCH_API_URL!);
  if (useFake) notes.push("using fake search client (fixtures)");

  return { store, repos: createRepos(store), search, notes };
}
