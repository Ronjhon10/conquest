// Request and response bodies for every route in specs/000-overview.md (HTTP API).
import { z } from "zod";
import {
  Ally,
  Attendee,
  BossSlot,
  CharacterClass,
  CoinGift,
  Conference,
  LeaderboardRow,
  Party,
  Quest,
  Recap,
  Report,
  Room,
  Speaker,
  SpeakerRecognition,
  Talk,
  XpEvent,
  XpKind,
} from "./schemas";

// ---------- Errors (OV-4) ----------

export const ErrorBody = z.object({ error: z.object({ code: z.string(), message: z.string() }) });
export type ErrorBody = z.infer<typeof ErrorBody>;

export function errorBody(code: string, message: string): ErrorBody {
  return { error: { code, message } };
}

export const Health = z.object({ ok: z.literal(true) });
export type Health = z.infer<typeof Health>;

// ---------- search-api (/api/search) ----------

export const SearchTalksQuery = z.object({
  q: z.string().default(""),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type SearchTalksQuery = z.infer<typeof SearchTalksQuery>;
export const SearchTalksResponse = z.object({
  results: z.array(z.object({ talk: Talk, score: z.number(), highlight: z.string().nullable() })),
});
export type SearchTalksResponse = z.infer<typeof SearchTalksResponse>;

/** All distinct venue rooms, independent of the paginated talk search results. */
export const SearchRoomsResponse = z.object({ rooms: z.array(z.string()) });
export type SearchRoomsResponse = z.infer<typeof SearchRoomsResponse>;

export const GetTalkResponse = z.object({ talk: Talk, speakers: z.array(Speaker) });
export type GetTalkResponse = z.infer<typeof GetTalkResponse>;

export const RankRequest = z.object({
  goals: z.array(z.string()).max(6),
  about: z.string(),
  limit: z.number().int().min(1).max(8).optional(),
});
export type RankRequest = z.infer<typeof RankRequest>;
export const RankResponse = z.object({ bosses: z.array(BossSlot) });
export type RankResponse = z.infer<typeof RankResponse>;

export const SuggestGoalsRequest = z.object({ about: z.string() });
export type SuggestGoalsRequest = z.infer<typeof SuggestGoalsRequest>;
export const SuggestGoalsResponse = z.object({ goals: z.array(z.string()) });
export type SuggestGoalsResponse = z.infer<typeof SuggestGoalsResponse>;

export const GetSpeakerResponse = z.object({ speaker: Speaker, talks: z.array(Talk) });
export type GetSpeakerResponse = z.infer<typeof GetSpeakerResponse>;

// ---------- game-api (/api/game) ----------

export const CreateConferenceRequest = z.object({
  name: z.string().min(1),
  theme_prompt: z.string(),
  rooms: z.array(Room).optional(),
});
export type CreateConferenceRequest = z.infer<typeof CreateConferenceRequest>;
export const ConferenceResponse = z.object({ conference: Conference });
export type ConferenceResponse = z.infer<typeof ConferenceResponse>;

export const PutQuestsRequest = z.object({ quests: z.array(Quest.omit({ id: true })) });
export type PutQuestsRequest = z.infer<typeof PutQuestsRequest>;

export const PutRoomsRequest = z.object({ rooms: z.array(Room) });
export type PutRoomsRequest = z.infer<typeof PutRoomsRequest>;

/** linkedin_url here is what the attendee pasted; game-api normalizes it (GM-19). */
export const DraftAttendeeRequest = z.object({
  conference_id: z.string().min(1),
  name: z.string().min(1),
  headline: z.string(),
  about: z.string(),
  linkedin_url: z.string().min(1),
});
export type DraftAttendeeRequest = z.infer<typeof DraftAttendeeRequest>;
export const DraftAttendeeResponse = z.object({
  class: CharacterClass,
  avatar_seed: z.string(),
  suggested_goals: z.array(z.string()),
});
export type DraftAttendeeResponse = z.infer<typeof DraftAttendeeResponse>;

/** photo is checked by game-api (GM-20), so it is a plain string here. */
export const CreateAttendeeRequest = DraftAttendeeRequest.extend({
  photo: z.string().optional(),
  class: CharacterClass,
  avatar_seed: z.string(),
  goals: z.array(z.string()).max(6),
});
export type CreateAttendeeRequest = z.infer<typeof CreateAttendeeRequest>;
export const AttendeeResponse = z.object({ attendee: Attendee });
export type AttendeeResponse = z.infer<typeof AttendeeResponse>;

export const GetAttendeeResponse = z.object({
  attendee: Attendee,
  party: Party.nullable(),
  allies: z.array(Ally),
});
export type GetAttendeeResponse = z.infer<typeof GetAttendeeResponse>;

export const XpRequest = z.object({
  attendee_id: z.string().min(1),
  kind: XpKind,
  talk_id: z.string().optional(),
  other_code: z.string().optional(),
  quest_id: z.string().optional(),
});
export type XpRequest = z.infer<typeof XpRequest>;
export const XpResponse = z.object({ event: XpEvent, attendee: Attendee });
export type XpResponse = z.infer<typeof XpResponse>;

export const CreatePartyRequest = z.object({ attendee_id: z.string().min(1), name: z.string().min(1) });
export type CreatePartyRequest = z.infer<typeof CreatePartyRequest>;
export const JoinPartyRequest = z.object({ attendee_id: z.string().min(1) });
export type JoinPartyRequest = z.infer<typeof JoinPartyRequest>;
export const PartyResponse = z.object({ party: Party });
export type PartyResponse = z.infer<typeof PartyResponse>;

export const GiveCoinRequest = z.object({
  from_attendee_id: z.string().min(1),
  talk_id: z.string().min(1),
  note: z.string().max(280),
});
export type GiveCoinRequest = z.infer<typeof GiveCoinRequest>;
export const GiveCoinResponse = z.object({ gift: CoinGift, attendee: Attendee });
export type GiveCoinResponse = z.infer<typeof GiveCoinResponse>;

export const LeaderboardQuery = z.object({ limit: z.coerce.number().int().min(1).max(100).default(10) });
export type LeaderboardQuery = z.infer<typeof LeaderboardQuery>;
export const LeaderboardResponse = z.object({ rows: z.array(LeaderboardRow) });
export type LeaderboardResponse = z.infer<typeof LeaderboardResponse>;

export const ReportResponse = z.object({ report: Report });
export type ReportResponse = z.infer<typeof ReportResponse>;

export const RecognitionResponse = z.object({ recognition: SpeakerRecognition });
export type RecognitionResponse = z.infer<typeof RecognitionResponse>;

export const RecapResponse = z.object({ recap: Recap });
export type RecapResponse = z.infer<typeof RecapResponse>;

// ---------- Elasticsearch index names (000) ----------

export const INDEX = {
  talks: "conquest-talks",
  speakers: "conquest-speakers",
  conferences: "conquest-conferences",
  attendees: "conquest-attendees",
  xpEvents: "conquest-xp-events",
  parties: "conquest-parties",
  coins: "conquest-coins",
} as const;
