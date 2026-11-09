// Routes built in BUILD G.3 (030 Behavior 4-5, allies). Mounted under /api/game by app.ts.
import { Hono } from "hono";
import type { Deps } from "../deps";
import { notImplemented } from "../http";

export function attendeesRoutes(_deps: Deps) {
  const r = new Hono();
  r.post("/attendees/draft", notImplemented("G.3"));
  r.post("/attendees", notImplemented("G.3"));
  r.get("/attendees/:id", notImplemented("G.3"));
  return r;
}
