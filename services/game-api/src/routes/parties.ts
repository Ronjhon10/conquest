// Routes built in BUILD G.5 (030 Behavior 14). Mounted under /api/game by app.ts.
import { Hono } from "hono";
import type { Deps } from "../deps";
import { notImplemented } from "../http";

export function partiesRoutes(_deps: Deps) {
  const r = new Hono();
  r.post("/parties", notImplemented("G.5"));
  r.post("/parties/:id/join", notImplemented("G.5"));
  return r;
}
