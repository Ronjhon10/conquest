import { describe, expect, it } from "vitest";
import { percentile, summarize } from "./stats";

describe("load stats", () => {
  it("percentile uses nearest rank and handles empty input", () => {
    expect(percentile([], 95)).toBe(0);
    expect(percentile([5], 95)).toBe(5);
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 50)).toBe(5);
    expect(percentile([10, 1, 9, 2, 8, 3, 7, 4, 6, 5], 95)).toBe(10);
  });

  it("summarize splits ok, 4xx, 5xx and network errors per route", () => {
    const rows = summarize([
      { route: "POST /xp", status: 200, ms: 100 },
      { route: "POST /xp", status: 409, ms: 50 },
      { route: "POST /xp", status: 500, ms: 900 },
      { route: "POST /xp", status: 0, ms: 10000 },
      { route: "GET /leaderboard", status: 200, ms: 40 },
    ]);
    expect(rows.map((r) => r.route)).toEqual(["GET /leaderboard", "POST /xp"]);
    expect(rows[1]).toMatchObject({ requests: 4, ok: 1, client_errors: 1, server_errors: 1, network_errors: 1, max: 10000 });
  });
});
