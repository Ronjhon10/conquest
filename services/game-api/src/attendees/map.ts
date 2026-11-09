// Building an attendee's map and goal quests at signup (030 Behavior 5).
import type { BossSlot, Quest, Talk } from "@conquest/contracts";
import type { Deps } from "../deps";

export const MAP_MAX = 6;
/** Short maps are topped up to this many bosses, as far as the schedule allows without clashes. */
export const MAP_MIN = 5;
export const FILLER_REASON = "Fits your background";

const overlaps = (a: Talk, b: Talk) => a.starts_at < b.ends_at && b.starts_at < a.ends_at;

/**
 * Bosses from search rank, topped up with non-clashing talks from the schedule when search finds
 * fewer than MAP_MIN. Returns the map in time order plus the talks it refers to.
 */
export async function buildMap(deps: Deps, goals: string[], about: string): Promise<{ map: BossSlot[]; talks: Map<string, Talk> }> {
  const ranked = await deps.search.rank({ goals, about, limit: MAP_MAX });
  const talks = new Map<string, Talk>();
  const found = await Promise.all(ranked.map((b) => deps.search.getTalk(b.talk_id)));
  for (const row of found) if (row) talks.set(row.talk.id, row.talk);
  const map = [...ranked];
  const pageSize = 100;
  // The first page may contain only simultaneous sessions. Continue until the map
  // reaches its documented minimum or the schedule really runs out.
  for (let offset = 0; map.length < MAP_MIN && offset <= 9900; offset += pageSize) {
    const schedule = await deps.search.searchTalks("", pageSize, offset);
    for (const talk of schedule) {
      if (map.length >= MAP_MIN) break;
      if (map.some((b) => b.talk_id === talk.id || (talks.has(b.talk_id) && overlaps(talks.get(b.talk_id)!, talk)))) continue;
      talks.set(talk.id, talk);
      map.push({ talk_id: talk.id, score: 0, reason: FILLER_REASON });
    }
    if (schedule.length < pageSize) break;
  }
  const start = (b: BossSlot) => talks.get(b.talk_id)?.starts_at ?? "";
  map.sort((a, b) => start(a).localeCompare(start(b)));
  return { map, talks };
}

const words = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2);

/** A boss counts for every goal it matches: the search reason names the goal, or a goal word is in the talk. */
export function bossMatchesGoal(boss: BossSlot, talk: Talk | undefined, goal: string): boolean {
  const needle = goal.trim().toLowerCase();
  if (!needle) return false;
  if (boss.reason.toLowerCase().includes(needle)) return true;
  if (!talk) return false;
  const text = new Set(words([talk.title, talk.abstract, talk.track ?? "", ...talk.tags].join(" ")));
  return words(goal).some((w) => text.has(w));
}

/** One "Defeat the <boss> of <goal>" quest per goal that has at least one matching boss. */
export function goalQuests(deps: Deps, goals: string[], map: BossSlot[], talks: Map<string, Talk>, bossNoun: string): Quest[] {
  return goals.flatMap((goal) => {
    const talk_ids = map.filter((b) => bossMatchesGoal(b, talks.get(b.talk_id), goal)).map((b) => b.talk_id);
    if (talk_ids.length === 0) return [];
    return [
      {
        id: deps.newId(),
        title: `Defeat the ${bossNoun} of ${goal}`,
        description: `Check in to a talk that matches your goal: ${goal}.`,
        xp: 100,
        kind: "goal" as const,
        sponsor: null,
        target: { type: "checkin" as const, count: 1, talk_ids },
      },
    ];
  });
}
