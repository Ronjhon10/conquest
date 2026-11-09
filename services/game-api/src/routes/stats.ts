// Leaderboard and report (BUILD G.8, 030 Behavior 16-17). Mounted under /api/game by app.ts.
import { LeaderboardQuery, type LeaderboardResponse, type ReportResponse } from "@conquest/contracts";
import { Hono } from "hono";
import type { Deps } from "../deps";
import { ApiError, parse } from "../http";
import { recoverPendingAwards } from "../xp/journal";

export function statsRoutes(deps: Deps) {
  const r = new Hono();

  async function requireConference(id: string) {
    if (!(await deps.repos.conferences.get(id))) throw new ApiError(404, "not_found", `No conference ${id}`);
  }

  r.get("/conferences/:id/leaderboard", async (c) => {
    const id = c.req.param("id");
    const { limit } = parse(LeaderboardQuery, c.req.query());
    await requireConference(id);
    await recoverPendingAwards(deps, id);
    // G.10: record conquest.leaderboard.duration
    const rows = await deps.stats.leaderboard(id, limit);
    return c.json({ rows } satisfies LeaderboardResponse);
  });

  r.get("/conferences/:id/report", async (c) => {
    const id = c.req.param("id");
    await requireConference(id);
    await recoverPendingAwards(deps, id);
    return c.json({ report: await deps.stats.report(id) } satisfies ReportResponse);
  });

  return r;
}
