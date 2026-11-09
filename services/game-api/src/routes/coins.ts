// Routes built in BUILD G.7 (030 Behavior 15, 18). Mounted under /api/game by app.ts.
import { GiveCoinRequest } from "@conquest/contracts";
import { Hono } from "hono";
import { giveCoin, speakerRecognition } from "../coins/coins";
import type { Deps } from "../deps";
import { body } from "../http";

export function coinsRoutes(deps: Deps) {
  const r = new Hono();
  r.post("/coins", async (c) => c.json(await giveCoin(deps, await body(c, GiveCoinRequest))));
  r.get("/speakers/:id/recognition", async (c) =>
    c.json({ recognition: await speakerRecognition(deps, c.req.param("id")) }),
  );
  return r;
}
