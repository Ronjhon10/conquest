// Read-only checks of a live, seeded search backend against 020's criteria. Never writes, so it is
// safe on the shared Elastic Serverless project (unlike the ES_INTEGRATION=1 tests, which reseed).
import type { Speaker, Talk } from "@conquest/contracts";
import { overlaps, rank } from "./rank";
import type { TalkStore } from "./store";
import { pickGoals } from "./suggest";

export type Check = { id: string; name: string; result: "pass" | "fail" | "skip"; detail: string };

const mentions = (re: RegExp) => (t: Talk) => re.test(t.title) || re.test(t.abstract) || t.tags.some((g) => re.test(g));

export async function verify(store: TalkStore, data: { talks: Talk[]; speakers: Speaker[] }, opts: { semantic: boolean }): Promise<Check[]> {
  const checks: Check[] = [];
  const check = async (id: string, name: string, run: () => Promise<[boolean, string] | "skip">) => {
    try {
      const r = await run();
      checks.push(r === "skip" ? { id, name, result: "skip", detail: "semantic search is off" } : { id, name, result: r[0] ? "pass" : "fail", detail: r[1] });
    } catch (err) {
      checks.push({ id, name, result: "fail", detail: err instanceof Error ? err.message : String(err) });
    }
  };

  await check("OV-3", "backend ready and seeded", async () => [await store.ready(), "talks and speakers indexes exist and are non-empty"]);
  await check("SR-1", "a sample of committed talks is in the index", async () => {
    const sample = data.talks.filter((_, i) => i % 40 === 0);
    const found = (await Promise.all(sample.map((t) => store.getTalk(t.id)))).filter(Boolean).length;
    return [found === sample.length, `${found}/${sample.length} found`];
  });
  await check("SR-3", "q=ebpf: eBPF talks first, each with a highlight", async () => {
    const top = await store.searchTalks("ebpf", 5);
    const ok = top.length > 0 && top.every((h) => mentions(/ebpf/i)(h.talk) && !!h.highlight);
    return [ok, top.map((h) => h.talk.title.slice(0, 50)).join(" | ")];
  });
  await check("SR-4", "q=kubernets security: security talks (fuzzy)", async () => {
    const top = await store.searchTalks("kubernets security", 5);
    return [top.length === 5 && top.every((h) => mentions(/secur/i)(h.talk)), top.map((h) => h.talk.title.slice(0, 50)).join(" | ")];
  });
  await check("SR-5", "semantic: 'keeping my cluster from getting hacked' finds security talks in the top 5", async () => {
    if (!opts.semantic) return "skip";
    const top = await store.searchTalks("keeping my cluster from getting hacked", 5);
    const sec = top.filter((h) => mentions(/secur/i)(h.talk)).length;
    return [sec > 0, `${sec}/5 security talks: ${top.map((h) => h.talk.title.slice(0, 40)).join(" | ")}`];
  });
  await check("SR-6/7/13", "rank: <= limit, no clashes, time order, every goal gets a boss", async () => {
    const goals = ["platform engineering", "ebpf observability", "kubernetes security"];
    const bosses = await rank(store, { goals, about: "SRE at a bank moving to an internal developer platform" });
    const talks = await Promise.all(bosses.map((b) => store.getTalk(b.talk_id)));
    if (talks.some((t) => !t)) return [false, "a boss talk id did not resolve"];
    const ts = talks as Talk[];
    const clash = ts.some((a, i) => ts.some((b, j) => j > i && overlaps(a, b)));
    const ordered = ts.every((t, i) => i === 0 || ts[i - 1]!.starts_at <= t.starts_at);
    const everyGoal = goals.every((g) => bosses.some((b) => b.reason === `Matches your goal "${g}"`));
    return [bosses.length > 0 && bosses.length <= 6 && !clash && ordered && everyGoal, `${bosses.length} bosses, clash=${clash}, ordered=${ordered}, everyGoal=${everyGoal}`];
  });
  await check("SR-10", "suggest-goals: 3-6 distinct phrases", async () => {
    const goals = pickGoals(await store.facets("ML engineer serving LLMs on GPUs"));
    return [goals.length >= 3 && goals.length <= 6 && new Set(goals).size === goals.length, goals.join(", ")];
  });
  await check("SR-12", "unknown talk id is not found", async () => [(await store.getTalk("talk-does-not-exist")) === null, "getTalk returned null"]);
  return checks;
}
