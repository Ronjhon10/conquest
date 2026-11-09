// The three organizer quests every new conference starts with (030 Behavior 2).
import type { PutQuestsRequest, Quest } from "@conquest/contracts";
import type { Deps } from "../deps";
import { checkQuests } from "../xp/award";

export function defaultQuests(newId: () => string): Quest[] {
  const organizer = { kind: "organizer", sponsor: null } as const;
  return [
    {
      ...organizer,
      id: newId(),
      title: "Meet five adventurers",
      description: "Scan five other attendees' codes to make allies.",
      xp: 150,
      target: { type: "network", count: 5, talk_ids: null },
    },
    {
      ...organizer,
      id: newId(),
      title: "Defeat three bosses",
      description: "Check in to three talks on your map.",
      xp: 200,
      target: { type: "boss", count: 3, talk_ids: null },
    },
    {
      ...organizer,
      id: newId(),
      title: "Capture the moment",
      description: "Share three photos from the conference.",
      xp: 75,
      target: { type: "photo", count: 3, talk_ids: null },
    },
  ];
}

/**
 * New conference quest list from a PUT (030 Behavior 2). A sent id that matches a current quest is
 * kept, so editing a quest doesn't make it look new to people who already finished it; any other
 * quest gets a fresh id.
 */
export function nextQuests(current: Quest[], sent: PutQuestsRequest["quests"], newId: () => string): Quest[] {
  const known = new Set(current.map((q) => q.id));
  return sent.map(({ id, ...q }) => ({ ...q, id: id && known.has(id) ? id : newId() }));
}

/**
 * Gives every attendee of the conference the new conference quests, keeping their own goal quests,
 * then runs quest completion so progress they already made counts. Removed quests just disappear
 * from the list; XP already earned from them is kept (nothing takes XP away).
 */
export async function syncAttendeeQuests(deps: Deps, conferenceId: string, previous: Quest[], quests: Quest[]) {
  const previousIds = new Set(previous.map((q) => q.id));
  const attendees = await deps.repos.attendees.find({ conference_id: conferenceId });
  for (const a of attendees) {
    await deps.repos.attendees.update(a.id, (cur) => ({
      ...cur,
      quests: [...cur.quests.filter((q) => !previousIds.has(q.id)), ...quests],
    }));
    await checkQuests(deps, a.id);
  }
}
