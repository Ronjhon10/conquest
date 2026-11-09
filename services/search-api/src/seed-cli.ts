// npm run seed -w services/search-api [-- --recreate]
// Reads data/kubecon-na-2026.ndjson and bulk-indexes it into ELASTICSEARCH_URL. With an OpenAI
// key the talks get semantic embeddings. --recreate drops conquest-talks first (needed once to
// add the semantic field to an index created without it).
import { INDEX } from "@conquest/contracts";
import { loadSchedule } from "./data";
import { ensureInferenceEndpoint } from "./embeddings";
import { clientFromEnv, esPort } from "./es";
import { seed } from "./seed";

const log = (level: string, msg: string, extra: object = {}) => console.log(JSON.stringify({ level, msg, ...extra }));

async function main() {
  const es = esPort(clientFromEnv());
  if (process.argv.includes("--recreate")) {
    await es.request("DELETE", `/${INDEX.talks}`);
    log("info", "dropped index", { index: INDEX.talks });
  }
  const semantic = await ensureInferenceEndpoint(es, process.env, log);
  const counts = await seed(es, await loadSchedule(), { semantic });
  log("info", "seeded", { ...counts, semantic });
}

main().catch((err: unknown) => {
  console.error(JSON.stringify({ level: "error", msg: err instanceof Error ? err.message : String(err) }));
  process.exit(1);
});
