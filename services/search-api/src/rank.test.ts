import { ErrorBody, RankResponse, fixtures, type Talk } from "@conquest/contracts";
import { describe, expect, it } from "vitest";
import { createApp } from "./app";
import { loadSchedule } from "./data";
import { BACKGROUND_REASON, fuse, goalReason, overlaps, pickBosses, rank } from "./rank";
import { MemoryTalkStore } from "./testing/memory-store";

const data = await loadSchedule();
const store = new MemoryTalkStore(data);
const app = createApp({ store });
const byId = new Map(data.talks.map((t) => [t.id, t]));

async function post(body: unknown) {
  return app.request("/api/search/rank", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });
}
async function bosses(body: unknown) {
  const res = await post(body);
  expect(res.status).toBe(200);
  return RankResponse.parse(await res.json()).bosses;
}

const persona = {
  goals: ["platform engineering", "ebpf observability", "kubernetes security", "AI inference on GPUs"],
  about: "SRE at a bank running hundreds of clusters, moving to an internal developer platform.",
};

describe("POST /rank (S.5)", () => {
  it("SR-6 returns at most `limit` bosses, none overlapping in time", async () => {
    for (const limit of [undefined, 1, 3, 8]) {
      const result = await bosses({ ...persona, limit });
      expect(result.length).toBeLessThanOrEqual(limit ?? 6);
      expect(result.length).toBe(limit ?? 6);
      const talks = result.map((b) => byId.get(b.talk_id)!);
      for (let i = 0; i < talks.length; i++) for (let j = i + 1; j < talks.length; j++) expect(overlaps(talks[i]!, talks[j]!), `${talks[i]!.id} vs ${talks[j]!.id}`).toBe(false);
    }
  });

  it("SR-6 a clashing talk is skipped and the next non-clashing one is picked", () => {
    const talks = new Map(fixtures.talks.map((t) => [t.id, t]));
    // talk-6 (10:00-10:45) clashes with talk-2 (10:00-10:30)
    const fused = ["talk-2", "talk-6", "talk-3"].map((talkId, i) => ({ talkId, score: 1 / (i + 1), reason: "r" }));
    expect(pickBosses(fused, talks, 2).map((b) => b.talk_id)).toEqual(["talk-2", "talk-3"]);
  });

  it("SR-6 limit above 8 is refused with the error shape", async () => {
    const res = await post({ ...persona, limit: 9 });
    expect(res.status).toBe(400);
    expect(ErrorBody.parse(await res.json()).error.code).toBe("bad_request");
  });

  it("SR-7 bosses are ordered by starts_at", async () => {
    const result = await bosses({ ...persona, limit: 8 });
    const starts = result.map((b) => byId.get(b.talk_id)!.starts_at);
    expect([...starts].sort()).toEqual(starts);
    const shuffled = pickBosses(
      [{ talkId: "talk-5", score: 3, reason: "a" }, { talkId: "talk-1", score: 2, reason: "b" }, { talkId: "talk-3", score: 1, reason: "c" }],
      new Map(fixtures.talks.map((t) => [t.id, t])),
      3,
    );
    expect(shuffled.map((b) => b.talk_id)).toEqual(["talk-1", "talk-3", "talk-5"]);
  });

  it("SR-8 each reason names the goal it best matched, or says Fits your background", async () => {
    const result = await bosses(persona);
    const allowed = new Set([...persona.goals.map(goalReason), BACKGROUND_REASON]);
    for (const b of result) expect(allowed.has(b.reason), b.reason).toBe(true);
    expect(result.some((b) => b.reason !== BACKGROUND_REASON)).toBe(true);
    // about only: every boss fits the background
    const aboutOnly = await bosses({ goals: [], about: persona.about });
    expect(aboutOnly.length).toBeGreaterThan(0);
    for (const b of aboutOnly) expect(b.reason).toBe(BACKGROUND_REASON);
  });

  it("SR-8 the reason is the goal list where the talk ranked best", () => {
    const fused = fuse([
      { goal: "a", weight: 1, talkIds: ["x", "y", "z"] },
      { goal: "b", weight: 1, talkIds: ["z", "x"] },
      { goal: null, weight: 0.5, talkIds: ["w", "z"] },
    ]);
    const reason = Object.fromEntries(fused.map((f) => [f.talkId, f.reason]));
    expect(reason).toEqual({ x: goalReason("a"), y: goalReason("a"), z: goalReason("b"), w: BACKGROUND_REASON });
  });

  it("SR-9 fusion: a talk ranked first for two goals scores above a talk ranked first for one goal", () => {
    const fused = fuse([
      { goal: "g1", weight: 1, talkIds: ["both", "solo2"] },
      { goal: "g2", weight: 1, talkIds: ["both", "x"] },
      { goal: "g3", weight: 1, talkIds: ["solo", "y"] },
    ]);
    const score = Object.fromEntries(fused.map((f) => [f.talkId, f.score]));
    expect(score.both).toBeCloseTo(2 / 61);
    expect(score.solo).toBeCloseTo(1 / 61);
    expect(score.both!).toBeGreaterThan(score.solo!);
    expect(fused[0]!.talkId).toBe("both");
  });

  it("SR-9 the about list counts half", () => {
    const fused = fuse([
      { goal: "g", weight: 1, talkIds: ["goalTop"] },
      { goal: null, weight: 0.5, talkIds: ["aboutTop"] },
    ]);
    expect(fused.map((f) => [f.talkId, f.score])).toEqual([
      ["goalTop", 1 / 61],
      ["aboutTop", 0.5 / 61],
    ]);
  });

  it("SR-6 no goals and no about returns no bosses; blank and duplicate goals are ignored", async () => {
    expect(await bosses({ goals: [], about: "" })).toEqual([]);
    const searched: string[] = [];
    const spy = { ...store, searchTalks: async (q: string, n: number) => (searched.push(q), store.searchTalks(q, n)) } as unknown as MemoryTalkStore;
    await rank(spy, { goals: ["ebpf", " ebpf ", ""], about: "" });
    expect(searched).toEqual(["ebpf"]);
  });

  it("SR-6 overlap treats back-to-back talks as not clashing", () => {
    const a = { starts_at: "2026-11-10T18:00:00.000Z", ends_at: "2026-11-10T18:30:00.000Z" } as Talk;
    const b = { starts_at: "2026-11-10T18:30:00.000Z", ends_at: "2026-11-10T19:00:00.000Z" } as Talk;
    expect(overlaps(a, b)).toBe(false);
    expect(overlaps(a, { ...b, starts_at: "2026-11-10T18:29:00.000Z" })).toBe(true);
  });

  it("SR-13 every goal gets a boss, even when the about text shares words with one goal", async () => {
    const goals = ["platform engineering", "ebpf observability", "kubernetes security"];
    const result = await bosses({ goals, about: "SRE at a bank moving to an internal developer platform" });
    expect(result).toHaveLength(6);
    for (const g of goals) expect(result.some((b) => b.reason === goalReason(g)), g).toBe(true);
    for (const limit of [1, 2, 3]) {
      const r = await bosses({ goals, about: persona.about, limit });
      expect(r).toHaveLength(limit);
      expect(new Set(r.map((b) => b.reason)).size).toBe(limit);
    }
  });

  it("SR-13 each goal's first pick is its own best non-clashing talk; the rest follow fused order", () => {
    const talks = new Map(fixtures.talks.map((t) => [t.id, t]));
    const lists = [
      { goal: "a", weight: 1, talkIds: ["talk-1", "talk-4"] },
      { goal: "b", weight: 1, talkIds: ["talk-2"] },
      { goal: null, weight: 0.5, talkIds: ["talk-1", "talk-4", "talk-6"] },
    ];
    // fused: talk-1 > talk-4 > talk-2 > talk-6; talk-6 clashes with talk-2
    const picked = pickBosses(fuse(lists), talks, 3, lists);
    expect(picked.map((b) => [b.talk_id, b.reason])).toEqual([
      ["talk-1", goalReason("a")],
      ["talk-2", goalReason("b")],
      ["talk-4", goalReason("a")],
    ]);
    // a goal whose only talk clashes with an earlier goal's pick gets nothing in round one
    const clash = [{ goal: "a", weight: 1, talkIds: ["talk-2"] }, { goal: "b", weight: 1, talkIds: ["talk-6"] }];
    expect(pickBosses(fuse(clash), talks, 2, clash).map((b) => b.talk_id)).toEqual(["talk-2"]);
  });
});

