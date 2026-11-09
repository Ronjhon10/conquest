import { serve } from "@hono/node-server";
import { createApp } from "./app";
import { loadSchedule } from "./data";
import { ensureInferenceEndpoint, searchOptions } from "./embeddings";
import { clientFromEnv, esPort } from "./es";
import { ensureIndexes } from "./indexes";
import { EsTalkStore, type TalkStore } from "./store";
import { MemoryTalkStore } from "./testing/memory-store";

const log = (level: string, msg: string, extra: object = {}) => console.log(JSON.stringify({ level, msg, ...extra }));

async function makeStore(): Promise<TalkStore> {
  if (!process.env.ELASTICSEARCH_URL) {
    log("warn", "ELASTICSEARCH_URL unset: serving the committed schedule from memory");
    return new MemoryTalkStore(await loadSchedule());
  }
  const es = esPort(clientFromEnv());
  let opts = { semantic: false, rrf: false };
  try {
    const embeddings = await ensureInferenceEndpoint(es, process.env, log);
    const { created } = await ensureIndexes(es, { semantic: embeddings });
    if (created.length) log("info", "created indexes", { created });
    opts = await searchOptions(es, embeddings, log);
    log("info", "search mode", opts);
  } catch (err) {
    // Keep serving; /readyz reports not ready until Elasticsearch answers.
    log("error", "could not ensure indexes", { error: err instanceof Error ? err.message : String(err) });
  }
  return new EsTalkStore(es, opts);
}

const port = Number(process.env.PORT ?? process.env.SEARCH_API_PORT ?? 4001);
const store = await makeStore();
serve({ fetch: createApp({ store }).fetch, port }, () => log("info", "conquest-search-api listening", { port }));
