// Contracts between lanes. Source of truth: specs/000-overview.md (Contracts, HTTP API).
// A change here must also change the spec, in the same PR (AGENTS.md rule 8).
import { z } from "zod";

const Id = z.string().min(1);
const IsoTime = z.string().datetime({ offset: true });
const Hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);

// ---------- Search lane documents ----------

export const Talk = z.object({
  id: Id,
  title: z.string(),
  abstract: z.string(),
  speaker_ids: z.array(Id),
  room: z.string(),
  starts_at: IsoTime,
  ends_at: IsoTime,
  track: z.string().nullable(),
  level: z.string().nullable(),
  tags: z.array(z.string()),
});
export type Talk = z.infer<typeof Talk>;

export const Speaker = z.object({
  id: Id,
  name: z.string(),
  company: z.string().nullable(),
  bio: z.string(),
  photo_url: z.string().nullable(),
});
export type Speaker = z.infer<typeof Speaker>;

export const BossSlot = z.object({ talk_id: Id, score: z.number(), reason: z.string() });
export type BossSlot = z.infer<typeof BossSlot>;

// ---------- Game lane documents ----------

export const Theme = z.object({
  name: z.string(),
  prompt: z.string(),
  palette: z.object({ bg: Hex, fg: Hex, accent: Hex }),
  boss_noun: z.string(),
  room_noun: z.string(),
  intro: z.string(),
});
export type Theme = z.infer<typeof Theme>;

/** "boss" counts check-ins to talks on the attendee's own map; "checkin" counts any talk. */
export const QuestTargetType = z.enum(["checkin", "boss", "photo", "network", "coin"]);
export type QuestTargetType = z.infer<typeof QuestTargetType>;

export const QuestTarget = z.object({
  type: QuestTargetType,
  count: z.number().int().positive(),
  talk_ids: z.array(Id).nullable(),
});
export type QuestTarget = z.infer<typeof QuestTarget>;

export const QuestKind = z.enum(["organizer", "sponsor", "goal"]);
export type QuestKind = z.infer<typeof QuestKind>;

export const Quest = z.object({
  id: Id,
  title: z.string(),
  description: z.string(),
  xp: z.number().int().nonnegative(),
  kind: QuestKind,
  sponsor: z.string().nullable(),
  target: QuestTarget,
});
export type Quest = z.infer<typeof Quest>;

export const Room = z.object({
  name: z.string(),
  step_free: z.boolean(),
  step_free_note: z.string().nullable(),
});
export type Room = z.infer<typeof Room>;

export const Conference = z.object({
  id: Id,
  name: z.string(),
  theme: Theme,
  quests: z.array(Quest),
  rooms: z.array(Room),
  created_at: IsoTime,
});
export type Conference = z.infer<typeof Conference>;

export const CharacterClass = z.enum(["knight", "wizard", "rogue", "bard"]);
export type CharacterClass = z.infer<typeof CharacterClass>;

/** Normalized form only. Validation/normalization of pasted input is game-api's job (GM-19). */
export const LinkedInUrl = z.string().regex(/^https:\/\/www\.linkedin\.com\/in\/[^/?#]+\/$/);
/** Profile photo: JPEG data URL, at most 40 KB of text (GM-20). */
export const PhotoDataUrl = z
  .string()
  .startsWith("data:image/jpeg;base64,")
  .max(40 * 1024);

export const Attendee = z.object({
  id: Id,
  conference_id: Id,
  name: z.string(),
  headline: z.string(),
  linkedin_url: LinkedInUrl.nullable(),
  photo: PhotoDataUrl.nullable(),
  class: CharacterClass,
  avatar_seed: z.string(),
  goals: z.array(z.string()),
  code: z.string().regex(/^[A-HJ-NP-Z2-9]{6}$/),
  party_id: Id.nullable(),
  xp: z.number().int().nonnegative(),
  level: z.number().int().positive(),
  coins: z.number().int().nonnegative(),
  map: z.array(BossSlot),
  quests: z.array(Quest),
  created_at: IsoTime,
});
export type Attendee = z.infer<typeof Attendee>;

export const XpKind = z.enum(["checkin", "photo", "network", "quest"]);
export type XpKind = z.infer<typeof XpKind>;

export const XpEvent = z.object({
  id: Id,
  conference_id: Id,
  attendee_id: Id,
  kind: XpKind,
  talk_id: Id.nullable(),
  other_attendee_id: Id.nullable(),
  quest_id: Id.nullable(),
  party_id: Id.nullable(),
  base_xp: z.number().int().nonnegative(),
  multiplier: z.number().positive(),
  xp: z.number().int().nonnegative(),
  at: IsoTime,
});
export type XpEvent = z.infer<typeof XpEvent>;

export const Party = z.object({
  id: Id,
  conference_id: Id,
  name: z.string(),
  member_ids: z.array(Id).max(4),
});
export type Party = z.infer<typeof Party>;

export const CoinGift = z.object({
  id: Id,
  conference_id: Id,
  from_attendee_id: Id,
  speaker_id: Id,
  talk_id: Id,
  note: z.string().max(280),
  at: IsoTime,
});
export type CoinGift = z.infer<typeof CoinGift>;

export const LeaderboardRow = z.object({
  attendee_id: Id,
  name: z.string(),
  class: CharacterClass,
  xp: z.number().int().nonnegative(),
  level: z.number().int().positive(),
  photo: PhotoDataUrl.nullable(),
  avatar_seed: z.string(),
});
export type LeaderboardRow = z.infer<typeof LeaderboardRow>;

export const Ally = z.object({
  attendee_id: Id,
  name: z.string(),
  headline: z.string(),
  linkedin_url: LinkedInUrl.nullable(),
  photo: PhotoDataUrl.nullable(),
});
export type Ally = z.infer<typeof Ally>;

export const Recap = z.object({
  post_text: z.string(),
  stats: z.object({
    bosses: z.number().int().nonnegative(),
    allies: z.number().int().nonnegative(),
    xp: z.number().int().nonnegative(),
    level: z.number().int().positive(),
    coins_given: z.number().int().nonnegative(),
  }),
});
export type Recap = z.infer<typeof Recap>;

export const Report = z.object({
  attendees: z.number().int().nonnegative(),
  checkins: z.number().int().nonnegative(),
  photos: z.number().int().nonnegative(),
  connections: z.number().int().nonnegative(),
  parties: z.number().int().nonnegative(),
  top_talks: z.array(z.object({ talk_id: Id, checkins: z.number().int().nonnegative() })),
  quest_completion: z.array(z.object({ quest_id: Id, completed: z.number().int().nonnegative() })),
  xp_by_hour: z.array(z.object({ hour: IsoTime, xp: z.number().int().nonnegative() })),
});
export type Report = z.infer<typeof Report>;

export const SpeakerRecognition = z.object({
  speaker_id: Id,
  coins: z.number().int().nonnegative(),
  notes: z.array(z.object({ from_name: z.string(), note: z.string(), talk_id: Id, at: IsoTime })),
});
export type SpeakerRecognition = z.infer<typeof SpeakerRecognition>;
