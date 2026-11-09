// Every XP award goes through awardXp (030 Behavior 6-13). Later steps hook in at the marked points.
import type { Attendee, XpEvent, XpKind } from "@conquest/contracts";
import type { Deps } from "../deps";
import { applyMultiplier, levelForXp } from "./rules";

export type AwardSpec = {
  kind: XpKind;
  baseXp: number;
  multiplier?: number;
  talkId?: string | null;
  otherAttendeeId?: string | null;
  questId?: string | null;
  coins?: number;
};

// G.5: 1.25 when a party member already checked into this talk (GM-7)
export async function partyMultiplier(_deps: Deps, _attendee: Attendee, _talkId: string): Promise<number> {
  return 1.0;
}

// G.6 (GM-10)
export async function checkQuests(_deps: Deps, _attendeeId: string): Promise<void> {}

/** Writes the event, then bumps the attendee's xp/level/coins with a versioned update. */
export async function awardXp(
  deps: Deps,
  attendee: Attendee,
  spec: AwardSpec,
): Promise<{ event: XpEvent; attendee: Attendee }> {
  // G.10: xp.award span + metrics here (GM-18)
  const multiplier = spec.multiplier ?? 1;
  const event = await deps.repos.xpEvents.create({
    id: deps.newId(),
    conference_id: attendee.conference_id,
    attendee_id: attendee.id,
    kind: spec.kind,
    talk_id: spec.talkId ?? null,
    other_attendee_id: spec.otherAttendeeId ?? null,
    quest_id: spec.questId ?? null,
    party_id: attendee.party_id,
    base_xp: spec.baseXp,
    multiplier,
    xp: applyMultiplier(spec.baseXp, multiplier),
    at: deps.now().toISOString(),
  });
  const updated = await deps.repos.attendees.update(attendee.id, (a) => {
    const xp = a.xp + event.xp;
    return { ...a, xp, level: levelForXp(xp), coins: a.coins + (spec.coins ?? 0) };
  });
  if (!updated) throw new Error(`attendee ${attendee.id} vanished during award`);
  await checkQuests(deps, attendee.id);
  return { event, attendee: updated };
}
