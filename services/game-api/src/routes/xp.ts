// Routes built in BUILD G.4 (030 Behavior 6-13); G.5/G.6/G.10 extend the award path. Mounted under /api/game by app.ts.
import { Hono } from "hono";
import type { Deps } from "../deps";
import { notImplemented } from "../http";

export function xpRoutes(_deps: Deps) {
  const r = new Hono();
  r.post("/xp", notImplemented("G.4"));
  return r;
}
