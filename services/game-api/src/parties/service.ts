// Party rules (030 Behavior 14). Throws ApiError for refusals.
import type { Party } from "@conquest/contracts";
import type { Deps } from "../deps";
import { ApiError } from "../http";
import { MAX_PARTY_SIZE } from "../xp/rules";

export async function createParty(deps: Deps, attendeeId: string, name: string): Promise<Party> {
  const attendee = await deps.repos.attendees.get(attendeeId);
  if (!attendee) throw new ApiError(404, "not_found", "Unknown attendee");
  if (attendee.party_id) throw new ApiError(409, "already_in_party", "Already in a party");
  const party = await deps.repos.parties.create({
    id: deps.newId(),
    conference_id: attendee.conference_id,
    name,
    member_ids: [attendee.id],
  });
  await deps.repos.attendees.update(attendee.id, (a) => ({ ...a, party_id: party.id }));
  return party;
}

export async function joinParty(deps: Deps, partyId: string, attendeeId: string): Promise<Party> {
  const [party, attendee] = await Promise.all([deps.repos.parties.get(partyId), deps.repos.attendees.get(attendeeId)]);
  if (!party) throw new ApiError(404, "not_found", "Unknown party");
  if (!attendee) throw new ApiError(404, "not_found", "Unknown attendee");
  if (attendee.party_id) throw new ApiError(409, "already_in_party", "Already in a party");
  if (party.conference_id !== attendee.conference_id) {
    throw new ApiError(400, "wrong_conference", "That party is at a different conference");
  }
  // Checked inside the versioned update so concurrent joins can't push a party past the cap.
  const updated = await deps.repos.parties.update(partyId, (p) => {
    if (p.member_ids.includes(attendee.id)) throw new ApiError(409, "already_in_party", "Already in a party");
    if (p.member_ids.length >= MAX_PARTY_SIZE) throw new ApiError(409, "party_full", "That party is full");
    return { ...p, member_ids: [...p.member_ids, attendee.id] };
  });
  if (!updated) throw new ApiError(404, "not_found", "Unknown party");
  await deps.repos.attendees.update(attendee.id, (a) => ({ ...a, party_id: partyId }));
  return updated;
}
