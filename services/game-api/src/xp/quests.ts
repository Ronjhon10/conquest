// Quest completion (030 Behavior 5 goal quests, Behavior 10; GM-10).
import type { Attendee, CoinGift, Quest, XpEvent } from "@conquest/contracts";
import type { Deps } from "../deps";
import { AlreadyExistsError } from "../store/store";
import { awardXp } from "./award";

/** Progress toward a quest from the attendee's events and gifts, already loaded (no I/O). */
export function progressFrom(attendee: Attendee, quest: Quest, events: XpEvent[], gifts: CoinGift[]): number {
  const { type, talk_ids } = quest.target;
  let rows: { talk_id: string | null }[] =
    type === "coin" ? gifts : events.filter((e) => e.kind === (type === "boss" ? "checkin" : type));
  // "boss" only counts check-ins to talks on the attendee's own map.
  if (type === "boss") {
    const map = new Set(attendee.map.map((b) => b.talk_id));
    rows = rows.filter((r) => r.talk_id !== null && map.has(r.talk_id));
  }
  // Quest events are never counted: only the target kinds above are read.
  return talk_ids === null ? rows.length : rows.filter((r) => r.talk_id !== null && talk_ids.includes(r.talk_id)).length;
}

async function isCompleted(deps: Deps, attendeeId: string, questId: string): Promise<boolean> {
  return (await deps.repos.xpEvents.count({ attendee_id: attendeeId, kind: "quest", quest_id: questId })) > 0;
}

/**
 * Awards every quest on the attendee whose target is now met and that isn't already completed.
 * Loads the attendee's events (and gifts, when a coin quest needs them) once and checks every quest
 * in memory: Elasticsearch is a ~60 ms round trip from the cluster, and the old per-quest
 * count/find calls made a check-in take seconds (P.W2). The completed check is re-run against
 * Elasticsearch right before awarding, since a nested or racing pass may have just completed it.
 * Awarding goes through awardXp, which calls back here; that terminates because each award
 * completes one quest. Returns the latest attendee (after any quest XP).
 */
export async function completeQuests(deps: Deps, attendeeId: string): Promise<Attendee | null> {
  const attendee = await deps.repos.attendees.get(attendeeId);
  if (!attendee) return null;
  const needsGifts = attendee.quests.some((q) => q.target.type === "coin");
  const [events, gifts] = await Promise.all([
    deps.repos.xpEvents.find({ attendee_id: attendeeId }),
    needsGifts ? deps.repos.coins.find({ from_attendee_id: attendeeId }) : Promise.resolve([] as CoinGift[]),
  ]);
  const completed = new Set(events.filter((e) => e.kind === "quest").map((e) => e.quest_id));
  let awarded = false;
  for (const quest of attendee.quests) {
    if (completed.has(quest.id)) continue;
    if (progressFrom(attendee, quest, events, gifts) < quest.target.count) continue;
    // Re-check immediately before awarding: a nested pass may have just completed it.
    if (await isCompleted(deps, attendeeId, quest.id)) continue;
    const current = (await deps.repos.attendees.get(attendeeId)) ?? attendee;
    try {
      await awardXp(deps, current, { kind: "quest", baseXp: quest.xp, questId: quest.id });
      awarded = true;
    } catch (err) {
      if (!(err instanceof AlreadyExistsError)) throw err; // another request completed it first
    }
  }
  // Nothing changed: the attendee we loaded is still the latest.
  return awarded ? deps.repos.attendees.get(attendeeId) : attendee;
}
