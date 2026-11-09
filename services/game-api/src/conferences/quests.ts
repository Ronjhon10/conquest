// The three organizer quests every new conference starts with (030 Behavior 2).
import type { Quest } from "@conquest/contracts";

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
      description: "Check in to three talks.",
      xp: 200,
      target: { type: "checkin", count: 3, talk_ids: null },
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
