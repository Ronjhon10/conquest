// Coins and speaker recognition (030 Behavior 15, 18; GM-13). Note text lives only in the
// coins index: it is never logged and never put on spans or metrics (000 telemetry rule).
import type { CoinGift, GiveCoinRequest, GiveCoinResponse, SpeakerRecognition } from "@conquest/contracts";
import type { Deps } from "../deps";
import { ApiError } from "../http";

const noCoins = () => new ApiError(409, "no_coins", "No coins left to give");

export async function giveCoin(deps: Deps, req: GiveCoinRequest): Promise<GiveCoinResponse> {
  const { repos } = deps;
  const attendee = await repos.attendees.get(req.from_attendee_id);
  if (!attendee) throw new ApiError(404, "not_found", "Attendee not found");

  const found = await deps.search.getTalk(req.talk_id);
  if (!found) throw new ApiError(404, "talk_not_found", "Talk not found");
  const speakerId = found.talk.speaker_ids[0];
  if (!speakerId) throw new ApiError(409, "no_speaker", "This talk has no speaker to give a coin to");

  const checkins = await repos.xpEvents.count({ attendee_id: attendee.id, kind: "checkin", talk_id: req.talk_id });
  if (checkins === 0) throw new ApiError(403, "not_checked_in", "Check in to this talk before giving a coin");
  if (attendee.coins < 1) throw noCoins();

  const already = await repos.coins.count({ from_attendee_id: attendee.id, talk_id: req.talk_id });
  if (already > 0) throw new ApiError(409, "already_gifted", "You already gave a coin for this talk");

  // The re-check inside the update keeps concurrent gifts from taking coins below zero.
  const updated = await repos.attendees.update(attendee.id, (a) => {
    if (a.coins < 1) throw noCoins();
    return { ...a, coins: a.coins - 1 };
  });
  if (!updated) throw new ApiError(404, "not_found", "Attendee not found");

  const gift: CoinGift = await repos.coins.create({
    id: deps.newId(),
    conference_id: attendee.conference_id,
    from_attendee_id: attendee.id,
    speaker_id: speakerId,
    talk_id: req.talk_id,
    note: req.note,
    at: deps.now().toISOString(),
  });
  return { gift, attendee: updated };
}

export async function speakerRecognition(deps: Deps, speakerId: string): Promise<SpeakerRecognition> {
  const gifts = await deps.repos.coins.find({ speaker_id: speakerId }, { sort: { field: "at", order: "desc" } });
  const names = new Map<string, string>();
  for (const id of new Set(gifts.map((g) => g.from_attendee_id))) {
    names.set(id, (await deps.repos.attendees.get(id))?.name ?? "A fellow attendee");
  }
  return {
    speaker_id: speakerId,
    coins: gifts.length,
    notes: gifts.map((g) => ({ from_name: names.get(g.from_attendee_id) ?? "", note: g.note, talk_id: g.talk_id, at: g.at })),
  };
}
