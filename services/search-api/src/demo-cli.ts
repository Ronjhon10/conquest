// npm run demo -w services/search-api > services/search-api/DEMO-SNAPSHOT.md
// Prints made-up demo personas' suggested goals and boss maps as Markdown, from the cluster in
// ELASTICSEARCH_URL (read-only) or, when unset, the in-memory store over the committed schedule.
import type { Talk } from "@conquest/contracts";
import { loadSchedule } from "./data";
import { searchOptions } from "./embeddings";
import { clientFromEnv, esPort } from "./es";
import { INFERENCE_ID } from "./indexes";
import { rank } from "./rank";
import { EsTalkStore, type TalkStore } from "./store";
import { pickGoals } from "./suggest";
import { MemoryTalkStore } from "./testing/memory-store";

/** Made-up people for the demo; no real attendees. */
export const PERSONAS = [
  { name: "Platform SRE", about: "SRE at a bank running hundreds of Kubernetes clusters, moving the org to an internal developer platform.", pick: 3 },
  { name: "ML engineer", about: "ML engineer serving LLMs on GPUs; I care about inference cost, autoscaling and agents in production.", pick: 3 },
  { name: "Security lead", about: "Security lead worried about supply chain attacks, policy enforcement and runtime threat detection.", pick: 3 },
  { name: "First-timer", about: "Frontend developer at a startup, first KubeCon, new to cloud native and containers.", pick: 2 },
];

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { timeZone: "America/Denver", weekday: "short", hour: "numeric", minute: "2-digit" });

async function main() {
  let store: TalkStore;
  let mode: string;
  if (process.env.ELASTICSEARCH_URL) {
    const es = esPort(clientFromEnv());
    const endpoint = await es.request("GET", `/_inference/text_embedding/${INFERENCE_ID}`);
    const opts = await searchOptions(es, endpoint.status === 200);
    store = new EsTalkStore(es, opts);
    mode = `Elasticsearch (${opts.semantic ? `hybrid BM25 + semantic, ${opts.rrf ? "RRF" : "bool.should"}` : "BM25 only"})`;
  } else {
    store = new MemoryTalkStore(await loadSchedule());
    mode = "in-memory stand-in (no ELASTICSEARCH_URL); real Elasticsearch ranking will differ";
  }
  const out: string[] = [`# Demo snapshot`, ``, `Backend: ${mode}. Generated ${new Date().toISOString().slice(0, 16)}Z by \`npm run demo -w services/search-api\`. Personas are made up.`, ``];
  for (const p of PERSONAS) {
    const suggested = pickGoals(await store.facets(p.about));
    const goals = suggested.slice(0, p.pick);
    const bosses = await rank(store, { goals, about: p.about });
    out.push(`## ${p.name}`, ``, `> ${p.about}`, ``, `Suggested goals: ${suggested.join(", ")}. Picked: **${goals.join(", ")}**.`, ``, `| When (MT) | Boss | Why |`, `| --- | --- | --- |`);
    for (const b of bosses) {
      const t = (await store.getTalk(b.talk_id)) as Talk;
      out.push(`| ${fmt(t.starts_at)} | ${t.title.replace(/\|/g, "/")} | ${b.reason} |`);
    }
    out.push(``);
  }
  console.log(out.join("\n"));
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
