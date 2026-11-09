// Quest completion (030 Behavior 5 goal quests, Behavior 10; GM-10).
import type { Attendee, Quest } from "@conquest/contracts";
import type { Deps } from "../deps";
import { awardXp } from "./award";

async function progress(deps: Deps, attendeeId: string, quest: Quest): Promise<number> {
  const { type, talk_ids } = quest.target;
  const rows =
    type === "coin"
      ? await deps.repos.coins.find({ from_attendee_id: attendeeId })
      : await deps.repos.xpEvents.find({ attendee_id: attendeeId, kind: type });
  // Quest events are never counted: only the target kinds above are read.
  return talk_ids === null ? rows.length : rows.filter((r) => r.talk_id !== null && talk_ids.includes(r.talk_id)).length;
}

async function isCompleted(deps: Deps, attendeeId: string, questId: string): Promise<boolean> {
  return (await deps.repos.xpEvents.count({ attendee_id: attendeeId, kind: "quest", quest_id: questId })) > 0;
}

/**
 * Awards every quest on the attendee whose target is now met and that isn't already completed.
 * Awarding goes through awardXp, which calls back here; that terminates because each award
 * completes one quest and the per-quest completed check is re-run right before awarding.
 * Returns the latest attendee (after any quest XP).
 */
export async function completeQuests(deps: Deps, attendeeId: string): Promise<Attendee | null> {
  const attendee = await deps.repos.attendees.get(attendeeId);
  if (!attendee) return null;
  for (const quest of attendee.quests) {
    if (await isCompleted(deps, attendeeId, quest.id)) continue;
    if ((await progress(deps, attendeeId, quest)) < quest.target.count) continue;
    // Re-check immediately before awarding: a nested pass may have just completed it.
    if (await isCompleted(deps, attendeeId, quest.id)) continue;
    const current = (await deps.repos.attendees.get(attendeeId)) ?? attendee;
    await awardXp(deps, current, { kind: "quest", baseXp: quest.xp, questId: quest.id });
  }
  return deps.repos.attendees.get(attendeeId);
}
