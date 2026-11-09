// What every route needs, built once. Tests pass in-memory pieces; the service builds them from env.
import { randomUUID } from "node:crypto";
import { type Llm, llmFromEnv } from "./llm";
import { createHttpSearchClient, createFakeSearchClient, type SearchClient } from "./search/client";
import { createElasticStore, esClientFromEnv } from "./store/elastic";
import { createMemoryStore } from "./store/memory";
import { createRepos, type Repos } from "./store/repos";
import type { DocStore } from "./store/store";

export type Deps = {
  store: DocStore;
  repos: Repos;
  search: SearchClient;
  /** null = no OPENAI_API_KEY: every feature uses its deterministic fallback (OV-5). */
  llm: Llm | null;
  /** Clock and id source, injectable so tests are deterministic. */
  now: () => Date;
  newId: () => string;
};

export function memoryDeps(over: Partial<Omit<Deps, "store" | "repos">> = {}): Deps {
  const store = createMemoryStore();
  return {
    store,
    repos: createRepos(store),
    search: createFakeSearchClient(),
    llm: null,
    now: () => new Date(),
    newId: randomUUID,
    ...over,
  };
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

  const llm = llmFromEnv(env);
  if (!llm) notes.push("OPENAI_API_KEY unset: using deterministic fallbacks");

  return { store, repos: createRepos(store), search, llm, now: () => new Date(), newId: randomUUID, notes };
}
