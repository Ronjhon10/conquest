import { log as tlog, type LogLevel } from "@conquest/telemetry";
import { serve } from "@hono/node-server";
import { createApp } from "./app";
import { loadSchedule } from "./data";
import { embeddingsAvailable, searchOptions } from "./embeddings";
import { clientFromEnv, esPort } from "./es";
import { ensureIndexes } from "./indexes";
import { EsTalkStore, type TalkStore } from "./store";
import { MemoryTalkStore } from "./testing/memory-store";

// JSON lines with trace_id/span_id, also sent as OTel logs (000). IDs and flags only, never text.
const log = (level: string, msg: string, extra: object = {}) =>
  tlog(level as LogLevel, msg, Object.fromEntries(Object.entries(extra).map(([k, v]) => [k, typeof v === "object" ? JSON.stringify(v) : v])));

async function makeStore(): Promise<TalkStore> {
  if (!process.env.ELASTICSEARCH_URL) {
    log("warn", "ELASTICSEARCH_URL unset: serving the committed schedule from memory");
    return new MemoryTalkStore(await loadSchedule());
  }
  const es = esPort(clientFromEnv());
  let opts = { semantic: false, rrf: false };
  try {
    const embeddings = await embeddingsAvailable(es, process.env, log);
    const { created } = await ensureIndexes(es, { semantic: embeddings });
    if (created.length) log("info", "created indexes", { created });
    opts = await searchOptions(es, embeddings, log);
    log("info", "search mode", opts);
  } catch (err) {
    // Keep serving; /readyz reports not ready until Elasticsearch answers.
    log("error", "could not ensure indexes", { error: err instanceof Error ? err.message : String(err) });
  }
  // While BM25 only, keep checking: a later `seed -- --recreate` with a key turns semantic on.
  return new EsTalkStore(es, opts, async () => searchOptions(es, await embeddingsAvailable(es)));
}

const port = Number(process.env.PORT ?? process.env.SEARCH_API_PORT ?? 4001);
const store = await makeStore();
serve({ fetch: createApp({ store }).fetch, port }, () => log("info", "conquest-search-api listening", { port }));
