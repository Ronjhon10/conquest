// npm run seed -w services/search-api
// Reads data/kubecon-na-2026.ndjson and bulk-indexes it into ELASTICSEARCH_URL.
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { parseNdjson } from "@conquest/seed";
import { clientFromEnv, esPort } from "./es";
import { seed } from "./seed";

const DATA = fileURLToPath(new URL("../../../data/kubecon-na-2026.ndjson", import.meta.url));

async function main() {
  const data = parseNdjson(await readFile(DATA, "utf8"));
  const counts = await seed(esPort(clientFromEnv()), data, { semantic: false });
  console.log(JSON.stringify({ level: "info", msg: "seeded", ...counts }));
}

main().catch((err: unknown) => {
  console.error(JSON.stringify({ level: "error", msg: err instanceof Error ? err.message : String(err) }));
  process.exit(1);
});
