// npm run verify -w services/search-api
// Read-only check of the cluster in ELASTICSEARCH_URL (from .env): seeded, and 020's criteria hold.
// Makes no writes: no index creation, no seeding, no inference endpoint creation.
import { loadSchedule } from "./data";
import { searchOptions } from "./embeddings";
import { clientFromEnv, esPort } from "./es";
import { INFERENCE_ID } from "./indexes";
import { EsTalkStore } from "./store";
import { verify } from "./verify";

async function main() {
  const es = esPort(clientFromEnv());
  const endpoint = await es.request("GET", `/_inference/text_embedding/${INFERENCE_ID}`);
  const opts = await searchOptions(es, endpoint.status === 200);
  console.log(`search mode: semantic=${opts.semantic} rrf=${opts.rrf}`);
  const checks = await verify(new EsTalkStore(es, opts), await loadSchedule(), opts);
  for (const c of checks) console.log(`${c.result.toUpperCase().padEnd(4)}  ${c.id.padEnd(10)} ${c.name}\n      ${c.detail}`);
  const failed = checks.filter((c) => c.result === "fail").length;
  console.log(failed ? `\n${failed} check(s) failed` : "\nall checks passed");
  process.exit(failed ? 1 : 0);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
