import { serve } from "@hono/node-server";
import { createApp } from "./app";
import { loadSchedule } from "./data";
import { clientFromEnv, esPort } from "./es";
import { ensureIndexes } from "./indexes";
import { EsTalkStore, type TalkStore } from "./store";
import { MemoryTalkStore } from "./testing/memory-store";

// startTelemetry("conquest-search-api") goes here first once packages/telemetry exists (BUILD P.3).
const log = (level: string, msg: string, extra: object = {}) => console.log(JSON.stringify({ level, msg, ...extra }));

async function makeStore(): Promise<TalkStore> {
  if (!process.env.ELASTICSEARCH_URL) {
    log("warn", "ELASTICSEARCH_URL unset: serving the committed schedule from memory");
    return new MemoryTalkStore(await loadSchedule());
  }
  const es = esPort(clientFromEnv());
  const opts = { semantic: false, rrf: false };
  try {
    const { created } = await ensureIndexes(es, opts);
    if (created.length) log("info", "created indexes", { created });
  } catch (err) {
    // Keep serving; /readyz reports not ready until Elasticsearch answers.
    log("error", "could not ensure indexes", { error: err instanceof Error ? err.message : String(err) });
  }
  return new EsTalkStore(es, opts);
}

const port = Number(process.env.PORT ?? process.env.SEARCH_API_PORT ?? 4001);
const store = await makeStore();
serve({ fetch: createApp({ store }).fetch, port }, () => log("info", "conquest-search-api listening", { port }));
