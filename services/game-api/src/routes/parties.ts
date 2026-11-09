// Routes built in BUILD G.5 (030 Behavior 14). Thin: rules live in src/parties/. Mounted under /api/game by app.ts.
import { CreatePartyRequest, JoinPartyRequest } from "@conquest/contracts";
import { Hono } from "hono";
import type { Deps } from "../deps";
import { body } from "../http";
import { createParty, joinParty } from "../parties/service";

export function partiesRoutes(deps: Deps) {
  const r = new Hono();
  r.post("/parties", async (c) => {
    const req = await body(c, CreatePartyRequest);
    return c.json({ party: await createParty(deps, req.attendee_id, req.name) });
  });
  r.post("/parties/:id/join", async (c) => {
    const req = await body(c, JoinPartyRequest);
    return c.json({ party: await joinParty(deps, c.req.param("id"), req.attendee_id) });
  });
  return r;
}
