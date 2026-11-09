// The three organizer quests every new conference starts with (030 Behavior 2).
import type { PutQuestsRequest, Quest } from "@conquest/contracts";
import type { Deps } from "../deps";
import { checkQuests } from "../xp/award";
import { scanRepo } from "../store/repos";

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
  return sent.map(({ id, ...q }) => {
    const keep = id !== undefined && known.delete(id);
    return { ...q, id: keep ? id : newId() };
  });
}

/**
 * Gives every attendee of the conference the new conference quests, keeping their own goal quests,
 * then runs quest completion so progress they already made counts. Removed quests just disappear
 * from the list; XP already earned from them is kept (nothing takes XP away).
 */
export async function syncAttendeeQuests(deps: Deps, conferenceId: string) {
  for await (const a of scanRepo(deps.repos.attendees, { conference_id: conferenceId })) {
    await deps.repos.attendees.update(a.id, async (cur) => {
      // Read the conference after the attendee version. A competing sync either wins
      // this CAS or causes us to retry against the latest conference, never an old PUT.
      const latest = await deps.repos.conferences.get(conferenceId);
      if (!latest) return cur;
      return { ...cur, quests: [...cur.quests.filter((q) => q.kind === "goal"), ...latest.quests] };
    });
    await checkQuests(deps, a.id);
  }
}
