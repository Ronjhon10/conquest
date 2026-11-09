// Stats computed in JS from the repos: used in tests and when ELASTICSEARCH_URL is unset.
import type { LeaderboardRow } from "@conquest/contracts";
import type { Repos } from "../store/repos";
import { compareTotals, reportFromEvents, type Stats, type XpTotal } from "./stats";

const ALL_EVENTS = 100_000;

/** Join ranked totals with attendee profiles; attendees that no longer exist are skipped. */
export async function joinAttendees(repos: Repos, totals: XpTotal[], limit: number): Promise<LeaderboardRow[]> {
  const rows: LeaderboardRow[] = [];
  for (const t of totals.slice().sort(compareTotals)) {
    if (rows.length >= limit) break;
    const a = await repos.attendees.get(t.attendee_id);
    if (!a) continue;
    rows.push({
      attendee_id: a.id,
      name: a.name,
      class: a.class,
      xp: t.xp,
      level: a.level,
      photo: a.photo,
      avatar_seed: a.avatar_seed,
    });
  }
  return rows;
}

export function createMemoryStats(repos: Repos): Stats {
  const events = (conferenceId: string) => repos.xpEvents.find({ conference_id: conferenceId }, { size: ALL_EVENTS });
  return {
    async leaderboard(conferenceId, limit) {
      const totals = new Map<string, XpTotal>();
      for (const e of await events(conferenceId)) {
        const t = totals.get(e.attendee_id) ?? { attendee_id: e.attendee_id, xp: 0, last_at_ms: 0 };
        t.xp += e.xp;
        t.last_at_ms = Math.max(t.last_at_ms, Date.parse(e.at));
        totals.set(e.attendee_id, t);
      }
      return joinAttendees(repos, [...totals.values()], limit);
    },
    async report(conferenceId) {
      const [evs, parties] = await Promise.all([events(conferenceId), repos.parties.count({ conference_id: conferenceId })]);
      return reportFromEvents(evs, parties);
    },
  };
}
