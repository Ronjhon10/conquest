// Party rules (030 Behavior 14). Throws ApiError for refusals.
import type { Party } from "@conquest/contracts";
import type { Deps } from "../deps";
import { ApiError } from "../http";
import { MAX_PARTY_SIZE } from "../xp/rules";

export async function createParty(deps: Deps, attendeeId: string, name: string): Promise<Party> {
  const attendee = await deps.repos.attendees.get(attendeeId);
  if (!attendee) throw new ApiError(404, "not_found", "Unknown attendee");
  if (attendee.party_id) throw new ApiError(409, "already_in_party", "Already in a party");
  const partyId = deps.newId();
  await claimParty(deps, attendee.id, partyId);
  try {
    return await deps.repos.parties.create({
      id: partyId,
      conference_id: attendee.conference_id,
      name,
      member_ids: [attendee.id],
    });
  } catch (err) {
    await releaseParty(deps, attendee.id, partyId);
    throw err;
  }
}

export async function joinParty(deps: Deps, partyId: string, attendeeId: string): Promise<Party> {
  const [party, attendee] = await Promise.all([deps.repos.parties.get(partyId), deps.repos.attendees.get(attendeeId)]);
  if (!party) throw new ApiError(404, "not_found", "Unknown party");
  if (!attendee) throw new ApiError(404, "not_found", "Unknown attendee");
  if (attendee.party_id) throw new ApiError(409, "already_in_party", "Already in a party");
  if (party.conference_id !== attendee.conference_id) {
    throw new ApiError(400, "wrong_conference", "That party is at a different conference");
  }
  await claimParty(deps, attendee.id, partyId);
  try {
    // Checked inside the versioned update so concurrent joins can't push a party past the cap.
    const updated = await deps.repos.parties.update(partyId, (p) => {
      if (p.member_ids.includes(attendee.id)) throw new ApiError(409, "already_in_party", "Already in a party");
      if (p.member_ids.length >= MAX_PARTY_SIZE) throw new ApiError(409, "party_full", "That party is full");
      return { ...p, member_ids: [...p.member_ids, attendee.id] };
    });
    if (!updated) throw new ApiError(404, "not_found", "Unknown party");
    return updated;
  } catch (err) {
    await releaseParty(deps, attendee.id, partyId);
    throw err;
  }
}

/** Claim the attendee first: checking an earlier snapshot cannot prevent two-party races. */
async function claimParty(deps: Deps, attendeeId: string, partyId: string) {
  const claimed = await deps.repos.attendees.update(attendeeId, (a) => {
    if (a.party_id) throw new ApiError(409, "already_in_party", "Already in a party");
    return { ...a, party_id: partyId };
  });
  if (!claimed) throw new ApiError(404, "not_found", "Unknown attendee");
}

async function releaseParty(deps: Deps, attendeeId: string, partyId: string) {
  await deps.repos.attendees.update(attendeeId, (a) => a.party_id === partyId ? { ...a, party_id: null } : a);
}
