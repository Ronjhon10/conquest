// POST /xp business rules (030 Behavior 6-9, 11). Throws ApiError for refusals.
import type { Attendee, XpRequest, XpResponse } from "@conquest/contracts";
import type { Deps } from "../deps";
import { ApiError } from "../http";
import { awardXp, partyMultiplier } from "./award";
import { BOSS_COIN_REWARD, checkinBaseXp, PHOTO_LIMIT, XP } from "./rules";

export async function handleXp(deps: Deps, req: XpRequest): Promise<XpResponse> {
  const attendee = await deps.repos.attendees.get(req.attendee_id);
  if (!attendee) throw new ApiError(404, "not_found", "Unknown attendee");
  switch (req.kind) {
    case "quest":
      throw new ApiError(400, "quest_auto", "Quests complete on their own");
    case "checkin":
      return checkin(deps, attendee, req);
    case "photo":
      return photo(deps, attendee, req);
    case "network":
      return network(deps, attendee, req);
  }
}

async function checkin(deps: Deps, attendee: Attendee, req: XpRequest): Promise<XpResponse> {
  if (!req.talk_id) throw new ApiError(400, "bad_request", "talk_id is required for a check-in");
  if (!(await deps.search.getTalk(req.talk_id))) throw new ApiError(404, "talk_not_found", "No such talk");
  const prior = await deps.repos.xpEvents.count({ attendee_id: attendee.id, kind: "checkin", talk_id: req.talk_id });
  if (prior > 0) throw new ApiError(409, "already_checked_in", "Already checked into this talk");
  const isBoss = attendee.map.some((b) => b.talk_id === req.talk_id);
  return awardXp(deps, attendee, {
    kind: "checkin",
    baseXp: checkinBaseXp(isBoss),
    multiplier: await partyMultiplier(deps, attendee, req.talk_id),
    talkId: req.talk_id,
    coins: isBoss ? BOSS_COIN_REWARD : 0,
  });
}

async function photo(deps: Deps, attendee: Attendee, req: XpRequest): Promise<XpResponse> {
  const taken = await deps.repos.xpEvents.count({ attendee_id: attendee.id, kind: "photo" });
  if (taken >= PHOTO_LIMIT) throw new ApiError(409, "photo_limit", `At most ${PHOTO_LIMIT} photos`);
  return awardXp(deps, attendee, { kind: "photo", baseXp: XP.photo, talkId: req.talk_id ?? null });
}

async function network(deps: Deps, attendee: Attendee, req: XpRequest): Promise<XpResponse> {
  if (!req.other_code) throw new ApiError(400, "bad_request", "other_code is required for networking");
  const code = req.other_code.trim().toUpperCase();
  if (code === attendee.code) throw new ApiError(400, "self", "You can't network with yourself");
  const [other] = await deps.repos.attendees.find({ conference_id: attendee.conference_id, code }, { size: 1 });
  if (!other) throw new ApiError(404, "not_found", "No adventurer with that code");
  if (other.id === attendee.id) throw new ApiError(400, "self", "You can't network with yourself");
  // Both directions commit the same attendee first. Exactly one racing request owns
  // that award; replay still finishes the partner if a prior request failed halfway.
  const [first, second] = [attendee, other].sort((a, b) => a.id.localeCompare(b.id));
  const one = await awardXp(deps, first!, { kind: "network", baseXp: XP.network, otherAttendeeId: second!.id });
  const two = await awardXp(deps, second!, { kind: "network", baseXp: XP.network, otherAttendeeId: first!.id });
  if (!one.created) throw new ApiError(409, "already_connected", "Already connected");
  const mine = first!.id === attendee.id ? one : two;
  return { event: mine.event, attendee: mine.attendee };
}
