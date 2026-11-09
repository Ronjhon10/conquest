// Mappings for the Game lane's indexes (000 Elasticsearch indexes, 030 Purpose).
// Ids, enums and foreign keys are keywords so they can be filtered and aggregated on.
import { INDEX } from "@conquest/contracts";
import type { estypes } from "@elastic/elasticsearch";

type Mapping = estypes.MappingTypeMapping;

const keyword = { type: "keyword" } as const;
const integer = { type: "integer" } as const;
const date = { type: "date" } as const;
/** Kept in _source but not searchable (photos, long text we never query). */
const stored = { type: "keyword", index: false, doc_values: false } as const;
const storedText = { type: "text", index: false } as const;

const quest = {
  properties: {
    id: keyword,
    title: storedText,
    description: storedText,
    xp: integer,
    kind: keyword,
    sponsor: keyword,
    target: { properties: { type: keyword, count: integer, talk_ids: keyword } },
  },
} as const;

export const GAME_INDEXES = {
  conferences: INDEX.conferences,
  attendees: INDEX.attendees,
  xpEvents: INDEX.xpEvents,
  parties: INDEX.parties,
  coins: INDEX.coins,
} as const;
export type GameIndex = (typeof GAME_INDEXES)[keyof typeof GAME_INDEXES];

// Additive, storage-only fields; the public attendee contract is unchanged.
export const XP_JOURNAL_MAPPING = {
  _xp_journal: { type: "object", enabled: false },
  _xp_pending: { type: "boolean" },
} as const;

export const MAPPINGS: Record<GameIndex, Mapping> = {
  [INDEX.conferences]: {
    dynamic: "strict",
    properties: {
      id: keyword,
      name: { type: "text", fields: { raw: keyword } },
      theme: { type: "object", enabled: false },
      quests: quest,
      rooms: { properties: { name: keyword, step_free: { type: "boolean" }, step_free_note: storedText } },
      created_at: date,
    },
  },
  [INDEX.attendees]: {
    dynamic: "strict",
    properties: {
      id: keyword,
      conference_id: keyword,
      name: { type: "text", fields: { raw: keyword } },
      headline: storedText,
      linkedin_url: keyword, // indexed: a second signup with the same link returns the existing attendee
      photo: stored, // 030 Behavior 5: stored with index: false
      class: keyword,
      avatar_seed: stored,
      goals: keyword,
      code: keyword,
      party_id: keyword,
      ...XP_JOURNAL_MAPPING,
      xp: integer,
      level: integer,
      coins: integer,
      map: { properties: { talk_id: keyword, score: { type: "float" }, reason: storedText } },
      quests: quest,
      created_at: date,
    },
  },
  [INDEX.xpEvents]: {
    dynamic: "strict",
    properties: {
      id: keyword,
      conference_id: keyword,
      attendee_id: keyword,
      kind: keyword,
      talk_id: keyword,
      other_attendee_id: keyword,
      quest_id: keyword,
      party_id: keyword,
      base_xp: integer,
      multiplier: { type: "float" },
      xp: integer,
      at: date,
    },
  },
  [INDEX.parties]: {
    dynamic: "strict",
    properties: { id: keyword, conference_id: keyword, name: storedText, member_ids: keyword },
  },
  [INDEX.coins]: {
    dynamic: "strict",
    properties: {
      id: keyword,
      conference_id: keyword,
      from_attendee_id: keyword,
      speaker_id: keyword,
      talk_id: keyword,
      note: storedText,
      at: date,
    },
  },
};
