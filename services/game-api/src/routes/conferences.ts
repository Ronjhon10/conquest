// Routes built in BUILD G.2 (030 Behavior 1-3). Mounted under /api/game by app.ts.
import { Hono } from "hono";
import type { Deps } from "../deps";
import { notImplemented } from "../http";

export function conferencesRoutes(_deps: Deps) {
  const r = new Hono();
  r.post("/conferences", notImplemented("G.2"));
  r.get("/conferences/:id", notImplemented("G.2"));
  r.put("/conferences/:id/quests", notImplemented("G.2"));
  r.put("/conferences/:id/rooms", notImplemented("G.2"));
  return r;
}
