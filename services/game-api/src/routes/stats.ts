// Routes built in BUILD G.8 (030 Behavior 16-17). Mounted under /api/game by app.ts.
import { Hono } from "hono";
import type { Deps } from "../deps";
import { notImplemented } from "../http";

export function statsRoutes(_deps: Deps) {
  const r = new Hono();
  r.get("/conferences/:id/leaderboard", notImplemented("G.8"));
  r.get("/conferences/:id/report", notImplemented("G.8"));
  return r;
}
