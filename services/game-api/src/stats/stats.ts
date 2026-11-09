// The Stats seam (030 Behavior 16-17): leaderboard and report are Elasticsearch aggregations over
// conquest-xp-events in the service, and the same answers computed in JS for tests / no-ES dev.
import type { LeaderboardRow, Report, XpEvent } from "@conquest/contracts";

export interface Stats {
  leaderboard(conferenceId: string, limit: number): Promise<LeaderboardRow[]>;
  report(conferenceId: string): Promise<Report>;
}

export const TOP_TALKS = 5;
export const HOUR_MS = 3_600_000;

/** One attendee's totals before they are joined with their profile. */
export type XpTotal = { attendee_id: string; xp: number; last_at_ms: number };

/** 030 Behavior 16: highest XP first; on a tie, the earliest last event wins; then id for determinism. */
export function compareTotals(a: XpTotal, b: XpTotal): number {
  return b.xp - a.xp || a.last_at_ms - b.last_at_ms || a.attendee_id.localeCompare(b.attendee_id);
}

export const hourIso = (ms: number) => new Date(Math.floor(ms / HOUR_MS) * HOUR_MS).toISOString();

/** The memory implementation's whole report computation, kept pure so tests can pin it. */
export function reportFromEvents(events: XpEvent[], parties: number): Report {
  const count = (kind: XpEvent["kind"]) => events.filter((e) => e.kind === kind).length;
  const tally = (kind: XpEvent["kind"], key: "talk_id" | "quest_id") => {
    const m = new Map<string, number>();
    for (const e of events) {
      const k = e[key];
      if (e.kind === kind && k) m.set(k, (m.get(k) ?? 0) + 1);
    }
    return [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  };
  const hours = new Map<number, number>();
  for (const e of events) {
    const h = Math.floor(Date.parse(e.at) / HOUR_MS) * HOUR_MS;
    hours.set(h, (hours.get(h) ?? 0) + e.xp);
  }
  return {
    attendees: new Set(events.map((e) => e.attendee_id)).size,
    checkins: count("checkin"),
    photos: count("photo"),
    connections: Math.floor(count("network") / 2),
    parties,
    top_talks: tally("checkin", "talk_id")
      .slice(0, TOP_TALKS)
      .map(([talk_id, checkins]) => ({ talk_id, checkins })),
    quest_completion: tally("quest", "quest_id").map(([quest_id, completed]) => ({ quest_id, completed })),
    xp_by_hour: [...hours].sort((a, b) => a[0] - b[0]).map(([h, xp]) => ({ hour: new Date(h).toISOString(), xp })),
  };
}
