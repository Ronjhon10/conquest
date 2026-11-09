// POST /rank: turn stated goals and about text into the bosses on the map (020 Behavior 4).
import type { BossSlot, RankRequest, Talk } from "@conquest/contracts";
import { SpanStatusCode, type Span } from "@opentelemetry/api";
import type { TalkHit, TalkStore } from "./store";
import { instruments, type Instruments } from "./telemetry";

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

/**
 * Pick the bosses (020 Behavior 4.3):
 * 1. One per goal first: for each goal in order, its own best-ranked talk that isn't picked and
 *    doesn't clash, with that goal as the reason. So the about text can't hand every slot to the
 *    one goal it shares words with.
 * 2. Fill the rest by walking the fused list, skipping clashes.
 * Then order by start time (4.5).
 */
export function pickBosses(fused: Fused[], talks: Map<string, Talk>, limit: number, lists: RankedList[] = []): BossSlot[] {
  const picked: { slot: BossSlot; talk: Talk }[] = [];
  const score = new Map(fused.map((f) => [f.talkId, f.score]));
  const fits = (talkId: string) => {
    const talk = talks.get(talkId);
    if (!talk || picked.some((p) => p.slot.talk_id === talkId || overlaps(p.talk, talk))) return null;
    return talk;
  };
  for (const list of lists) {
    if (list.goal === null || picked.length >= limit) continue;
    for (const talkId of list.talkIds) {
      const talk = fits(talkId);
      if (!talk) continue;
      picked.push({ slot: { talk_id: talkId, score: score.get(talkId) ?? 0, reason: goalReason(list.goal) }, talk });
      break;
    }
  }
  for (const f of fused) {
    if (picked.length >= limit) break;
    const talk = fits(f.talkId);
    if (talk) picked.push({ slot: { talk_id: f.talkId, score: f.score, reason: f.reason }, talk });
  }
  return picked
    .sort((a, b) => a.talk.starts_at.localeCompare(b.talk.starts_at) || a.talk.id.localeCompare(b.talk.id))
    .map((p) => p.slot);
}

export async function rank(store: TalkStore, req: RankRequest, inst: Instruments = instruments()): Promise<BossSlot[]> {
  const limit = Math.min(req.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
  const goals = [...new Set(req.goals.map((g) => g.trim()).filter(Boolean))].slice(0, 6);
  const about = req.about.trim();
  const queries: { goal: string | null; weight: number; text: string }[] = [
    ...goals.map((g) => ({ goal: g, weight: 1, text: g })),
    ...(about ? [{ goal: null, weight: 0.5, text: about }] : []),
  ];

  // 020 Behavior 6: one span, a child per search, duration histogram. Counts only, never text.
  const started = performance.now();
  return inst.tracer.startActiveSpan(
    "search.rank",
    { attributes: { "conquest.search.goals_count": goals.length, "conquest.search.has_about": about.length > 0, "conquest.search.limit": limit } },
    async (span) => {
      let outcome = "ok";
      try {
        if (queries.length === 0) {
          span.setAttribute("conquest.search.bosses_count", 0);
          return [];
        }
        const results = await Promise.all(
          queries.map((q, i) =>
            inst.tracer.startActiveSpan(
              "search.rank.query",
              { attributes: { "conquest.search.list": q.goal === null ? "about" : "goal", "conquest.search.list_index": i } },
              (child) => traced(child, () => store.searchTalks(q.text, PER_LIST), (hits: TalkHit[]) => child.setAttribute("conquest.search.hits", hits.length)),
            ),
          ),
        );
        const talks = new Map<string, Talk>();
        const lists = queries.map((q, i) => {
          for (const h of results[i]!) talks.set(h.talk.id, h.talk);
          return { goal: q.goal, weight: q.weight, talkIds: results[i]!.map((h) => h.talk.id) };
        });
        const bosses = pickBosses(fuse(lists), talks, limit, lists);
        span.setAttribute("conquest.search.bosses_count", bosses.length);
        return bosses;
      } catch (err) {
        outcome = "error";
        markError(span, err);
        throw err;
      } finally {
        span.end();
        inst.rankDuration.record(performance.now() - started, { outcome });
      }
    },
  );
}

async function traced<T>(span: Span, run: () => Promise<T>, onOk: (v: T) => void): Promise<T> {
  try {
    const v = await run();
    onOk(v);
    return v;
  } catch (err) {
    markError(span, err);
    throw err;
  } finally {
    span.end();
  }
}

/** Error status with the error's class only: messages can echo the query text. */
function markError(span: Span, err: unknown) {
  const type = err instanceof Error ? err.constructor.name : "unknown";
  span.setStatus({ code: SpanStatusCode.ERROR, message: type });
  span.setAttribute("error.type", type);
}
