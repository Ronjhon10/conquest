import { Hono } from "hono";
import { installErrorHandling, notImplemented } from "./http";

export function createApp() {
  const app = new Hono();
  installErrorHandling(app);

  const health = { ok: true as const };
  app.get("/healthz", (c) => c.json(health));

  const api = new Hono();
  api.get("/healthz", (c) => c.json(health));
  api.get("/talks", notImplemented("S.3"));
  api.get("/talks/:id", notImplemented("S.3"));
  api.get("/speakers/:id", notImplemented("S.3"));
  api.post("/rank", notImplemented("S.5"));
  api.post("/suggest-goals", notImplemented("S.6"));
  app.route("/api/search", api);

  return app;
}
