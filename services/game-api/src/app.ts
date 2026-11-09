import { Hono } from "hono";
import { installErrorHandling, notImplemented } from "./http";

export function createApp() {
  const app = new Hono();
  installErrorHandling(app);

  const health = { ok: true as const };
  app.get("/healthz", (c) => c.json(health));
  app.get("/readyz", (c) => c.json(health)); // lanes: check Elasticsearch here once it is wired

  const api = new Hono();
  api.get("/healthz", (c) => c.json(health));
  api.post("/conferences", notImplemented("G.2"));
  api.get("/conferences/:id", notImplemented("G.2"));
  api.put("/conferences/:id/quests", notImplemented("G.2"));
  api.put("/conferences/:id/rooms", notImplemented("G.2"));
  api.get("/conferences/:id/leaderboard", notImplemented("G.8"));
  api.get("/conferences/:id/report", notImplemented("G.8"));
  api.post("/attendees/draft", notImplemented("G.3"));
  api.post("/attendees", notImplemented("G.3"));
  api.get("/attendees/:id", notImplemented("G.3"));
  api.post("/attendees/:id/recap", notImplemented("G.9"));
  api.post("/xp", notImplemented("G.4"));
  api.post("/parties", notImplemented("G.5"));
  api.post("/parties/:id/join", notImplemented("G.5"));
  api.post("/coins", notImplemented("G.7"));
  api.get("/speakers/:id/recognition", notImplemented("G.7"));
  app.route("/api/game", api);

  return app;
}
