// Every XP award goes through awardXp (030 Behavior 6-13). Later steps hook in at the marked points.
import type { Attendee, XpEvent, XpKind } from "@conquest/contracts";
import type { Deps } from "../deps";
import { completeQuests } from "./quests";
import { applyMultiplier, PARTY_MULTIPLIER } from "./rules";
import { commitAward, publishPendingAwards } from "./journal";
import { ApiError } from "../http";

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
export async function partyMultiplier(deps: Deps, attendee: Attendee, talkId: string): Promise<number> {
  if (!attendee.party_id) return 1.0;
  const party = await deps.repos.parties.get(attendee.party_id);
  if (!party) return 1.0;
  for (const memberId of party.member_ids) {
    if (memberId === attendee.id) continue;
    if ((await deps.repos.xpEvents.count({ attendee_id: memberId, kind: "checkin", talk_id: talkId })) > 0) {
      return PARTY_MULTIPLIER;
    }
  }
  return 1.0;
}

// G.6 (GM-10)
// Returns the latest attendee after any quest XP; POST /coins calls this too.
export async function checkQuests(deps: Deps, attendeeId: string): Promise<Attendee | null> {
  return completeQuests(deps, attendeeId);
}

/** Atomically commit totals and the pending event, then publish and complete quests. */
export async function awardXp(
  deps: Deps,
  attendee: Attendee,
  spec: AwardSpec,
): Promise<{ event: XpEvent; attendee: Attendee; created: boolean }> {
  // G.10: xp.award span + metrics here (GM-18)
  const multiplier = spec.multiplier ?? 1;
  await publishPendingAwards(deps, attendee.id);
  const committed = await commitAward(deps, {
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
  }, spec.coins ?? 0);
  await publishPendingAwards(deps, attendee.id);
  if (!committed.created && spec.kind === "checkin") {
    throw new ApiError(409, "already_checked_in", "Already checked into this talk");
  }
  const latest = committed.created ? await checkQuests(deps, attendee.id) : null;
  return { ...committed, attendee: latest ?? committed.attendee };
}
