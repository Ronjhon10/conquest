// game-api's view of search-api (030 Interface). The HTTP client calls SEARCH_API_URL; the fake
// answers from the contracts fixtures with the same interface, for tests and until search lands.
import {
  type BossSlot,
  GetTalkResponse,
  RankResponse,
  type RankRequest,
  SearchTalksResponse,
  SuggestGoalsResponse,
  type Speaker,
  type Talk,
  fixtures,
} from "@conquest/contracts";
import type { z } from "zod";

export interface SearchClient {
  rank(req: RankRequest): Promise<BossSlot[]>;
  suggestGoals(about: string): Promise<string[]>;
  /** null when the talk doesn't exist (030 Behavior 8: check-ins need a real talk). */
  getTalk(id: string): Promise<{ talk: Talk; speakers: Speaker[] } | null>;
  searchTalks(q: string, limit?: number): Promise<Talk[]>;
}

export class SearchApiError extends Error {}

export function createHttpSearchClient(baseUrl: string, fetchImpl: typeof fetch = fetch): SearchClient {
  const root = `${baseUrl.replace(/\/$/, "")}/api/search`;

  async function call<S extends z.ZodType>(path: string, schema: S, init?: RequestInit): Promise<z.infer<S> | null> {
    const res = await fetchImpl(`${root}${path}`, {
      ...init,
      headers: { "content-type": "application/json", ...init?.headers },
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new SearchApiError(`search-api ${init?.method ?? "GET"} ${path} answered ${res.status}`);
    return schema.parse(await res.json());
  }
  const post = (body: unknown): RequestInit => ({ method: "POST", body: JSON.stringify(body) });
  const required = <T>(v: T | null, path: string): T => {
    if (v === null) throw new SearchApiError(`search-api ${path} answered 404`);
    return v;
  };

  return {
    async rank(req) {
      return required(await call("/rank", RankResponse, post(req)), "/rank").bosses;
    },
    async suggestGoals(about) {
      return required(await call("/suggest-goals", SuggestGoalsResponse, post({ about })), "/suggest-goals").goals;
    },
    async getTalk(id) {
      return call(`/talks/${encodeURIComponent(id)}`, GetTalkResponse);
    },
    async searchTalks(q, limit = 20) {
      const params = new URLSearchParams({ q, limit: String(limit) });
      const r = required(await call(`/talks?${params}`, SearchTalksResponse), "/talks");
      return r.results.map((x) => x.talk);
    },
  };
}

/**
 * Deterministic stand-in for search-api over a fixed talk list. Ranking is a plain word match,
 * but it keeps the 020 rules game-api relies on: at most `limit` bosses, no time clashes,
 * ordered by start time, reasons naming the matched goal.
 */
export function createFakeSearchClient(
  talks: Talk[] = fixtures.talks,
  speakers: Speaker[] = fixtures.speakers,
): SearchClient {
  const words = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2);
  const text = (t: Talk) => new Set(words([t.title, t.abstract, t.track ?? "", ...t.tags].join(" ")));
  const hits = (t: Talk, query: string) => words(query).filter((w) => text(t).has(w)).length;
  const overlaps = (a: Talk, b: Talk) => a.starts_at < b.ends_at && b.starts_at < a.ends_at;

  return {
    async rank({ goals, about, limit = 6 }) {
      const scored = talks
        .map((talk) => {
          const perGoal = goals.map((g) => ({ goal: g, n: hits(talk, g) })).sort((a, b) => b.n - a.n);
          const best = perGoal[0];
          const goalScore = perGoal.reduce((sum, g) => sum + g.n, 0);
          const aboutScore = hits(talk, about) / 2;
          const reason = best && best.n > 0 ? `Matches your goal "${best.goal}"` : "Fits your background";
          return { talk, score: goalScore + aboutScore, reason };
        })
        .filter((s) => s.score > 0)
        .sort((a, b) => b.score - a.score || a.talk.starts_at.localeCompare(b.talk.starts_at));

      const picked: typeof scored = [];
      for (const s of scored) {
        if (picked.length >= limit) break;
        if (!picked.some((p) => overlaps(p.talk, s.talk))) picked.push(s);
      }
      return picked
        .sort((a, b) => a.talk.starts_at.localeCompare(b.talk.starts_at))
        .map((s) => ({ talk_id: s.talk.id, score: s.score, reason: s.reason }));
    },

    async suggestGoals(about) {
      const counts = new Map<string, number>();
      for (const t of talks) if (hits(t, about) > 0 && t.track) counts.set(t.track, (counts.get(t.track) ?? 0) + 1);
      const goals = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([track]) => track);
      for (const t of talks) if (goals.length < 3 && t.track && !goals.includes(t.track)) goals.push(t.track);
      return goals.slice(0, 6);
    },

    async getTalk(id) {
      const talk = talks.find((t) => t.id === id);
      if (!talk) return null;
      return { talk, speakers: talk.speaker_ids.flatMap((sid) => speakers.filter((s) => s.id === sid)) };
    },

    async searchTalks(q, limit = 20) {
      const found = q.trim() === "" ? talks : talks.filter((t) => hits(t, q) > 0);
      return found.slice(0, limit);
    },
  };
}
