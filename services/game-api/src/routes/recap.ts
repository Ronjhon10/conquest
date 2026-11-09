// POST /attendees/:id/recap (BUILD G.9, 030 Behavior 19). Mounted under /api/game by app.ts.
import { RecapResponse } from "@conquest/contracts";
import { Hono } from "hono";
import type { Deps } from "../deps";
import { ApiError } from "../http";
import { buildRecap } from "../recap/recap";

export function recapRoutes(deps: Deps) {
  const r = new Hono();
  r.post("/attendees/:id/recap", async (c) => {
    const attendee = await deps.repos.attendees.get(c.req.param("id"));
    if (!attendee) throw new ApiError(404, "not_found", "No such attendee");
    return c.json(RecapResponse.parse({ recap: await buildRecap(deps, attendee) }));
  });
  return r;
}
