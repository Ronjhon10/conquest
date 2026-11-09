// POST /rank: turn stated goals and about text into the bosses on the map (020 Behavior 4).
import type { BossSlot, RankRequest, Talk } from "@conquest/contracts";
import type { TalkStore } from "./store";

export const RRF_K = 60;
export const PER_LIST = 20;
export const DEFAULT_LIMIT = 6;
export const MAX_LIMIT = 8;
export const BACKGROUND_REASON = "Fits your background";

/** One ranked result list: from a goal, or (goal null) from the about text. */
export type RankedList = { goal: string | null; weight: number; talkIds: string[] };
export type Fused = { talkId: string; score: number; reason: string };

export const goalReason = (goal: string) => `Matches your goal "${goal}"`;

/**
 * Reciprocal rank fusion (020 Behavior 4.2): score = sum of weight / (60 + rank), rank from 1.
 * The reason is the goal list where the talk ranked best (earlier goal on a tie); a talk found
 * only by the about text gets "Fits your background" (4.4).
 */
export function fuse(lists: RankedList[]): Fused[] {
  const acc = new Map<string, { score: number; best: { goal: string; rank: number } | null; first: number }>();
  let order = 0;
  for (const list of lists) {
    list.talkIds.forEach((talkId, i) => {
      const rank = i + 1;
      const cur = acc.get(talkId) ?? { score: 0, best: null, first: order++ };
      cur.score += list.weight / (RRF_K + rank);
      if (list.goal !== null && (!cur.best || rank < cur.best.rank)) cur.best = { goal: list.goal, rank };
      acc.set(talkId, cur);
    });
  }
  return [...acc.entries()]
    .sort(([, a], [, b]) => b.score - a.score || a.first - b.first)
    .map(([talkId, v]) => ({ talkId, score: v.score, reason: v.best ? goalReason(v.best.goal) : BACKGROUND_REASON }));
}

export function overlaps(a: Pick<Talk, "starts_at" | "ends_at">, b: Pick<Talk, "starts_at" | "ends_at">): boolean {
  return Date.parse(a.starts_at) < Date.parse(b.ends_at) && Date.parse(b.starts_at) < Date.parse(a.ends_at);
}

/** Walk the fused list in order, skip talks that clash with one already picked (4.3), then order by time (4.5). */
export function pickBosses(fused: Fused[], talks: Map<string, Talk>, limit: number): BossSlot[] {
  const picked: { slot: BossSlot; talk: Talk }[] = [];
  for (const f of fused) {
    if (picked.length >= limit) break;
    const talk = talks.get(f.talkId);
    if (!talk || picked.some((p) => overlaps(p.talk, talk))) continue;
    picked.push({ slot: { talk_id: f.talkId, score: f.score, reason: f.reason }, talk });
  }
  return picked
    .sort((a, b) => a.talk.starts_at.localeCompare(b.talk.starts_at) || a.talk.id.localeCompare(b.talk.id))
    .map((p) => p.slot);
}

export async function rank(store: TalkStore, req: RankRequest): Promise<BossSlot[]> {
  const limit = Math.min(req.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
  const goals = [...new Set(req.goals.map((g) => g.trim()).filter(Boolean))].slice(0, 6);
  const about = req.about.trim();
  const queries: { goal: string | null; weight: number; text: string }[] = [
    ...goals.map((g) => ({ goal: g, weight: 1, text: g })),
    ...(about ? [{ goal: null, weight: 0.5, text: about }] : []),
  ];
  if (queries.length === 0) return [];

  const results = await Promise.all(queries.map((q) => store.searchTalks(q.text, PER_LIST)));
  const talks = new Map<string, Talk>();
  const lists = queries.map((q, i) => {
    for (const h of results[i]!) talks.set(h.talk.id, h.talk);
    return { goal: q.goal, weight: q.weight, talkIds: results[i]!.map((h) => h.talk.id) };
  });
  return pickBosses(fuse(lists), talks, limit);
}
