// npm run seed -w services/search-api
// Reads data/kubecon-na-2026.ndjson and bulk-indexes it into ELASTICSEARCH_URL.
import { loadSchedule } from "./data";
import { clientFromEnv, esPort } from "./es";
import { seed } from "./seed";

async function main() {
  const counts = await seed(esPort(clientFromEnv()), await loadSchedule(), { semantic: false });
  console.log(JSON.stringify({ level: "info", msg: "seeded", ...counts }));
}

main().catch((err: unknown) => {
  console.error(JSON.stringify({ level: "error", msg: err instanceof Error ? err.message : String(err) }));
  process.exit(1);
});
