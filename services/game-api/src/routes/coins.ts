// Routes built in BUILD G.7 (030 Behavior 15, 18). Mounted under /api/game by app.ts.
import { Hono } from "hono";
import type { Deps } from "../deps";
import { notImplemented } from "../http";

export function coinsRoutes(_deps: Deps) {
  const r = new Hono();
  r.post("/coins", notImplemented("G.7"));
  r.get("/speakers/:id/recognition", notImplemented("G.7"));
  return r;
}
