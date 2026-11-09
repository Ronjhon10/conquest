// Every XP award goes through awardXp (030 Behavior 6-13). Later steps hook in at the marked points.
import type { Attendee, XpEvent, XpKind } from "@conquest/contracts";
import { SpanStatusCode } from "@opentelemetry/api";
import type { Deps } from "../deps";
import { checkinsCount, tracer, xpAwardedCounter } from "../telemetry";
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
  // One query for the talk's check-ins, not one per member: round trips are slow on Serverless.
  const others = new Set(party.member_ids.filter((id) => id !== attendee.id));
  if (others.size === 0) return 1.0;
  const checkins = await deps.repos.xpEvents.find({ kind: "checkin", talk_id: talkId });
  return checkins.some((e) => others.has(e.attendee_id)) ? PARTY_MULTIPLIER : 1.0;
}

// G.6 (GM-10)
// Returns the latest attendee after any quest XP; POST /coins calls this too.
export async function checkQuests(deps: Deps, attendeeId: string): Promise<Attendee | null> {
  return completeQuests(deps, attendeeId);
}

type AwardResult = { event: XpEvent; attendee: Attendee; created: boolean };

/** xp.award span + metrics around the award (GM-18). Attributes are ids, kinds and counts only. */
export async function awardXp(deps: Deps, attendee: Attendee, spec: AwardSpec): Promise<AwardResult> {
  return tracer().startActiveSpan("xp.award", async (span) => {
    try {
      const party = attendee.party_id ? await deps.repos.parties.get(attendee.party_id) : null;
      span.setAttributes({
        "conquest.conference.id": attendee.conference_id,
        "conquest.xp.kind": spec.kind,
        "conquest.xp.amount": applyMultiplier(spec.baseXp, spec.multiplier ?? 1),
        "conquest.party.size": party?.member_ids.length ?? 0,
      });
      const result = await awardXpInner(deps, attendee, spec);
      span.setAttribute("conquest.xp.amount", result.event.xp);
      // A replayed award (created false) was already counted when it first happened.
      if (result.created) {
        xpAwardedCounter().add(result.event.xp, { kind: spec.kind });
        if (spec.kind === "checkin") checkinsCount().add(1);
      }
      return result;
    } catch (err) {
      span.recordException(err instanceof Error ? err : new Error(String(err)));
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw err;
    } finally {
      span.end();
    }
  });
}

/** Atomically commit totals and the pending event, then publish and complete quests. */
async function awardXpInner(deps: Deps, attendee: Attendee, spec: AwardSpec): Promise<AwardResult> {
  const multiplier = spec.multiplier ?? 1;
  await publishPendingAwards(deps, attendee.id);
  const committed = await commitAward(deps, {
    // Fixed id per attendee and quest, so racing completions can only pay once.
    id: spec.kind === "quest" && spec.questId ? `${attendee.id}:quest:${spec.questId}` : deps.newId(),
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
  // Quest XP never counts toward a quest target, so a quest award can't complete another quest.
  const latest = committed.created && spec.kind !== "quest" ? await checkQuests(deps, attendee.id) : null;
  return { ...committed, attendee: latest ?? committed.attendee };
}
