// Routes built in BUILD G.9 (030 Behavior 19). Mounted under /api/game by app.ts.
import { Hono } from "hono";
import type { Deps } from "../deps";
import { notImplemented } from "../http";

export function recapRoutes(_deps: Deps) {
  const r = new Hono();
  r.post("/attendees/:id/recap", notImplemented("G.9"));
  return r;
}
