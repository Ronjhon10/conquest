// Quest completion (030 Behavior 5 goal quests, Behavior 10; GM-10).
import type { Attendee, Quest, XpEvent } from "@conquest/contracts";
import type { Deps } from "../deps";
import { AlreadyExistsError } from "../store/store";
import { awardXp } from "./award";

type Row = { talk_id: string | null };

/** Progress toward one quest, from rows already loaded (no store reads per quest). */
function progress(attendee: Attendee, quest: Quest, events: XpEvent[], gifts: Row[]): number {
  const { type, talk_ids } = quest.target;
  let rows: Row[] = type === "coin" ? gifts : events.filter((e) => e.kind === (type === "boss" ? "checkin" : type));
  // "boss" only counts check-ins to talks on the attendee's own map.
  if (type === "boss") {
    const map = new Set(attendee.map.map((b) => b.talk_id));
    rows = rows.filter((r) => r.talk_id !== null && map.has(r.talk_id));
  }
  // Quest events are never counted: only the target kinds above are read.
  return talk_ids === null ? rows.length : rows.filter((r) => r.talk_id !== null && talk_ids.includes(r.talk_id)).length;
}

/**
 * Awards every quest on the attendee whose target is now met and that isn't already completed.
 * Reads the attendee's events once (and coin gifts only if a coin quest is open): on Elastic
 * Serverless every round trip is slow, and per-quest reads pushed party check-ins past the 15 s
 * gateway timeout. A quest award never re-runs this (quest XP counts toward no target), and
 * commitAward refuses a second award of the same quest, so racing passes still pay once.
 * Returns the latest attendee (after any quest XP).
 */
export async function completeQuests(deps: Deps, attendeeId: string): Promise<Attendee | null> {
  let attendee = await deps.repos.attendees.get(attendeeId);
  if (!attendee) return null;
  const events = await deps.repos.xpEvents.find({ attendee_id: attendeeId });
  const done = new Set(events.flatMap((e) => (e.kind === "quest" && e.quest_id ? [e.quest_id] : [])));
  const open = attendee.quests.filter((q) => !done.has(q.id));
  const gifts = open.some((q) => q.target.type === "coin") ? await deps.repos.coins.find({ from_attendee_id: attendeeId }) : [];
  for (const quest of open) {
    if (progress(attendee, quest, events, gifts) < quest.target.count) continue;
    try {
      attendee = (await awardXp(deps, attendee, { kind: "quest", baseXp: quest.xp, questId: quest.id })).attendee;
    } catch (err) {
      if (!(err instanceof AlreadyExistsError)) throw err; // another request completed it first
    }
  }
  return attendee;
}
