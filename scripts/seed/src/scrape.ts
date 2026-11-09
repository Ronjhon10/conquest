// npm run scrape -w scripts/seed
// One polite GET of the public KubeCon + CloudNativeCon NA 2026 schedule page (no login),
// then writes data/kubecon-na-2026.ndjson (020 Behavior 1). Pass a saved HTML file path to
// rebuild offline without touching the network: npm run scrape -w scripts/seed -- page.html
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { extractScheduleJson, toNdjson, transform } from "./transform";

export const SCHEDULE_URL = "https://events.linuxfoundation.org/kubecon-cloudnativecon-north-america/program/schedule/";
const OUT = fileURLToPath(new URL("../../../data/kubecon-na-2026.ndjson", import.meta.url));

async function main() {
  const file = process.argv[2];
  const html = file
    ? await readFile(file, "utf8")
    : await fetch(SCHEDULE_URL, { headers: { "user-agent": "conquest-hackathon-seed/0.1 (one-time schedule import)" } }).then(
        async (r) => {
          if (!r.ok) throw new Error(`GET ${SCHEDULE_URL} -> ${r.status}`);
          return r.text();
        },
      );
  const data = transform(extractScheduleJson(html));
  await writeFile(OUT, toNdjson(data));
  console.log(JSON.stringify({ level: "info", msg: "wrote seed", talks: data.talks.length, speakers: data.speakers.length, out: OUT }));
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
