// Stats as real Elasticsearch aggregations over conquest-xp-events (030 Behavior 16-17).
// Query building and response parsing are pure functions so they are tested without a cluster.
import { INDEX, type LeaderboardRow, type Report } from "@conquest/contracts";
import type { Client, estypes } from "@elastic/elasticsearch";
import type { Repos } from "../store/repos";
import { joinAttendees } from "./memory";
import { hourIso, type Stats, TOP_TALKS, type XpTotal } from "./stats";

/** Ask for a few more buckets than `limit` so ties can be re-broken exactly even across shards. */
export const LEADERBOARD_EXTRA = 5;
const BUCKETS = 1000;

type Buckets = { buckets: { key: string; doc_count: number }[] };

export function leaderboardQuery(conferenceId: string, limit: number): estypes.SearchRequest {
  const size = limit + LEADERBOARD_EXTRA;
  return {
    index: INDEX.xpEvents,
    size: 0,
    query: { bool: { filter: [{ term: { conference_id: conferenceId } }] } },
    aggs: {
      by_attendee: {
        terms: {
          field: "attendee_id",
          size,
          shard_size: size * 3,
          // highest total XP first; ties: earliest last event first
          order: [{ xp: "desc" }, { last_at: "asc" }],
        },
        aggs: { xp: { sum: { field: "xp" } }, last_at: { max: { field: "at" } } },
      },
    },
  };
}

export type LeaderboardAggs = {
  by_attendee?: { buckets: { key: string; xp: { value: number | null }; last_at: { value: number | null } }[] };
};

export function parseLeaderboard(aggs: LeaderboardAggs | undefined): XpTotal[] {
  return (aggs?.by_attendee?.buckets ?? []).map((b) => ({
    attendee_id: b.key,
    xp: Math.round(b.xp.value ?? 0),
    last_at_ms: b.last_at.value ?? 0,
  }));
}

export function reportQuery(conferenceId: string): estypes.SearchRequest {
  const ofKind = (kind: string) => ({ filter: { term: { kind } } });
  return {
    index: INDEX.xpEvents,
    size: 0,
    query: { bool: { filter: [{ term: { conference_id: conferenceId } }] } },
    aggs: {
      by_kind: { terms: { field: "kind", size: 10 } },
      // distinct attendees who earned XP (exact below the default precision threshold of 3000)
      attendees: { cardinality: { field: "attendee_id" } },
      talks: { ...ofKind("checkin"), aggs: { top: { terms: { field: "talk_id", size: TOP_TALKS } } } },
      quests: { ...ofKind("quest"), aggs: { by_quest: { terms: { field: "quest_id", size: BUCKETS } } } },
      xp_by_hour: {
        date_histogram: { field: "at", fixed_interval: "1h", min_doc_count: 1 },
        aggs: { xp: { sum: { field: "xp" } } },
      },
    },
  };
}

export type ReportAggs = {
  by_kind?: Buckets;
  attendees?: { value: number };
  talks?: { top?: Buckets };
  quests?: { by_quest?: Buckets };
  xp_by_hour?: { buckets: { key: number; doc_count: number; xp: { value: number | null } }[] };
};

export function parseReport(aggs: ReportAggs | undefined, parties: number): Report {
  const kinds = new Map((aggs?.by_kind?.buckets ?? []).map((b) => [b.key, b.doc_count]));
  return {
    attendees: aggs?.attendees?.value ?? 0,
    checkins: kinds.get("checkin") ?? 0,
    photos: kinds.get("photo") ?? 0,
    connections: Math.floor((kinds.get("network") ?? 0) / 2),
    parties,
    top_talks: (aggs?.talks?.top?.buckets ?? []).map((b) => ({ talk_id: b.key, checkins: b.doc_count })),
    quest_completion: (aggs?.quests?.by_quest?.buckets ?? []).map((b) => ({ quest_id: b.key, completed: b.doc_count })),
    xp_by_hour: (aggs?.xp_by_hour?.buckets ?? []).map((b) => ({ hour: hourIso(b.key), xp: Math.round(b.xp.value ?? 0) })),
  };
}

export function createElasticStats(es: Client, repos: Repos): Stats {
  return {
    async leaderboard(conferenceId, limit): Promise<LeaderboardRow[]> {
      const r = await es.search(leaderboardQuery(conferenceId, limit));
      return joinAttendees(repos, parseLeaderboard(r.aggregations as LeaderboardAggs | undefined), limit);
    },
    async report(conferenceId) {
      const [r, parties] = await Promise.all([
        es.search(reportQuery(conferenceId)),
        repos.parties.count({ conference_id: conferenceId }),
      ]);
      return parseReport(r.aggregations as ReportAggs | undefined, parties);
    },
  };
}
