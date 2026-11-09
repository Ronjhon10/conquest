import { describe, expect, it } from "vitest";
import { leaderboardQuery, LEADERBOARD_EXTRA, parseLeaderboard, parseReport, reportQuery } from "./elastic";

describe("elastic leaderboard query", () => {
  it("GM-14 sums xp per attendee, orders by xp desc then earliest last event, filtered on the conference", () => {
    const q = leaderboardQuery("conf-1", 10);
    expect(q.size).toBe(0);
    expect(q.index).toBe("conquest-xp-events");
    expect(q.query).toEqual({ bool: { filter: [{ term: { conference_id: "conf-1" } }] } });
    const agg = q.aggs?.by_attendee as { terms: Record<string, unknown>; aggs: unknown };
    expect(agg.terms).toMatchObject({ field: "attendee_id", size: 10 + LEADERBOARD_EXTRA, order: [{ xp: "desc" }, { last_at: "asc" }] });
    expect(agg.aggs).toEqual({ xp: { sum: { field: "xp" } }, last_at: { max: { field: "at" } } });
  });

  it("GM-14 parses buckets into totals", () => {
    const totals = parseLeaderboard({
      by_attendee: {
        buckets: [
          { key: "a1", xp: { value: 170.0 }, last_at: { value: 1794218400000 } },
          { key: "a2", xp: { value: null }, last_at: { value: null } },
        ],
      },
    });
    expect(totals).toEqual([
      { attendee_id: "a1", xp: 170, last_at_ms: 1794218400000 },
      { attendee_id: "a2", xp: 0, last_at_ms: 0 },
    ]);
    expect(parseLeaderboard(undefined)).toEqual([]);
  });
});

describe("elastic report query", () => {
  it("GM-15 asks for kinds, cardinality, top 5 check-in talks, quest completions and hourly XP", () => {
    const q = reportQuery("conf-1");
    expect(q.size).toBe(0);
    expect(q.query).toEqual({ bool: { filter: [{ term: { conference_id: "conf-1" } }] } });
    expect(q.aggs).toMatchObject({
      by_kind: { terms: { field: "kind" } },
      attendees: { cardinality: { field: "attendee_id" } },
      talks: { filter: { term: { kind: "checkin" } }, aggs: { top: { terms: { field: "talk_id", size: 5 } } } },
      quests: { filter: { term: { kind: "quest" } }, aggs: { by_quest: { terms: { field: "quest_id" } } } },
      xp_by_hour: { date_histogram: { field: "at", fixed_interval: "1h" }, aggs: { xp: { sum: { field: "xp" } } } },
    });
  });

  it("GM-15 parses a hand-written response into the report", () => {
    const report = parseReport(
      {
        by_kind: {
          buckets: [
            { key: "checkin", doc_count: 4 },
            { key: "network", doc_count: 3 },
            { key: "quest", doc_count: 3 },
            { key: "photo", doc_count: 1 },
          ],
        },
        attendees: { value: 3 },
        talks: { top: { buckets: [{ key: "talk-1", doc_count: 2 }, { key: "talk-2", doc_count: 2 }] } },
        quests: { by_quest: { buckets: [{ key: "q-meet5", doc_count: 2 }, { key: "q-boss3", doc_count: 1 }] } },
        xp_by_hour: {
          buckets: [
            { key: Date.parse("2026-11-09T10:00:00.000Z"), doc_count: 3, xp: { value: 150 } },
            { key: Date.parse("2026-11-09T11:00:00.000Z"), doc_count: 8, xp: { value: 460 } },
          ],
        },
      },
      1,
    );
    expect(report).toEqual({
      attendees: 3,
      checkins: 4,
      photos: 1,
      connections: 1,
      parties: 1,
      top_talks: [{ talk_id: "talk-1", checkins: 2 }, { talk_id: "talk-2", checkins: 2 }],
      quest_completion: [{ quest_id: "q-meet5", completed: 2 }, { quest_id: "q-boss3", completed: 1 }],
      xp_by_hour: [{ hour: "2026-11-09T10:00:00.000Z", xp: 150 }, { hour: "2026-11-09T11:00:00.000Z", xp: 460 }],
    });
  });

  it("GM-15 an empty response is an all-zero report", () => {
    expect(parseReport(undefined, 0)).toEqual({
      attendees: 0,
      checkins: 0,
      photos: 0,
      connections: 0,
      parties: 0,
      top_talks: [],
      quest_completion: [],
      xp_by_hour: [],
    });
  });
});
