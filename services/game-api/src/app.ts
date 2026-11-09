import { Hono } from "hono";
import { type Deps, memoryDeps } from "./deps";
import { fail, installErrorHandling } from "./http";
import { attendeesRoutes } from "./routes/attendees";
import { coinsRoutes } from "./routes/coins";
import { conferencesRoutes } from "./routes/conferences";
import { partiesRoutes } from "./routes/parties";
import { recapRoutes } from "./routes/recap";
import { statsRoutes } from "./routes/stats";
import { xpRoutes } from "./routes/xp";

export function createApp(deps: Deps = memoryDeps()) {
  const app = new Hono();
  installErrorHandling(app);

  const health = { ok: true as const };
  app.get("/healthz", (c) => c.json(health));
  app.get("/readyz", async (c) =>
    (await deps.store.ping()) ? c.json(health) : fail(c, 503, "not_ready", "Elasticsearch is not answering"),
  );

  // One file per area so steps can be built in parallel without touching each other.
  const api = new Hono();
  api.get("/healthz", (c) => c.json(health));
  for (const routes of [conferencesRoutes, statsRoutes, attendeesRoutes, recapRoutes, xpRoutes, partiesRoutes, coinsRoutes]) {
    api.route("/", routes(deps));
  }
  app.route("/api/game", api);

  return app;
}
