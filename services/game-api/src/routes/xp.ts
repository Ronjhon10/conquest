// POST /xp (BUILD G.4, 030 Behavior 6-13). Thin: rules and awards live in src/xp/. Mounted under /api/game by app.ts.
import { XpRequest, XpResponse } from "@conquest/contracts";
import { Hono } from "hono";
import type { Deps } from "../deps";
import { body } from "../http";
import { handleXp } from "../xp/handle";

export function xpRoutes(deps: Deps) {
  const r = new Hono();
  r.post("/xp", async (c) => c.json(XpResponse.parse(await handleXp(deps, await body(c, XpRequest)))));
  return r;
}
