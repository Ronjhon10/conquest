// The committed schedule (data/kubecon-na-2026.ndjson), for seeding and the no-Elasticsearch fallback.
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { parseNdjson } from "@conquest/seed";

export const DATA_FILE = fileURLToPath(new URL("../../../data/kubecon-na-2026.ndjson", import.meta.url));

export async function loadSchedule() {
  return parseNdjson(await readFile(DATA_FILE, "utf8"));
}
