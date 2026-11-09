import { GetSpeakerResponse, GetTalkResponse, RankRequest, RankResponse, SearchRoomsResponse, SearchTalksQuery, SearchTalksResponse, SuggestGoalsRequest, SuggestGoalsResponse } from "@conquest/contracts";
import { Hono } from "hono";
import { ApiError, body, installErrorHandling, parse } from "./http";
import { rank } from "./rank";
import { pickGoals } from "./suggest";
import type { TalkStore } from "./store";

export type AppDeps = { store?: TalkStore };

export function createApp({ store }: AppDeps = {}) {
  const app = new Hono();
  installErrorHandling(app);

  const health = { ok: true as const };
  const need = (): TalkStore => {
    if (!store) throw new ApiError(503, "unavailable", "Search backend is not configured");
    return store;
  };
  app.get("/healthz", (c) => c.json(health));
  app.get("/readyz", async (c) => {
    if (store && !(await store.ready())) return c.json({ error: { code: "not_ready", message: "Search indexes not reachable or not seeded yet" } }, 503);
    return c.json(health);
  });

  const api = new Hono();
  api.get("/healthz", (c) => c.json(health));

  api.get("/talks", async (c) => {
    const { q, limit } = parse(SearchTalksQuery, c.req.query());
    const results = await need().searchTalks(q, limit);
    return c.json(SearchTalksResponse.parse({ results }));
  });

  api.get("/rooms", async (c) => c.json(SearchRoomsResponse.parse({ rooms: await need().rooms() })));

  api.get("/talks/:id", async (c) => {
    const s = need();
    const talk = await s.getTalk(c.req.param("id"));
    if (!talk) throw new ApiError(404, "not_found", "No talk with that id");
    return c.json(GetTalkResponse.parse({ talk, speakers: await s.getSpeakers(talk.speaker_ids) }));
  });

  api.get("/speakers/:id", async (c) => {
    const s = need();
    const speaker = await s.getSpeaker(c.req.param("id"));
    if (!speaker) throw new ApiError(404, "not_found", "No speaker with that id");
    return c.json(GetSpeakerResponse.parse({ speaker, talks: await s.talksBySpeaker(speaker.id) }));
  });

  api.post("/rank", async (c) => {
    const req = await body(c, RankRequest);
    return c.json(RankResponse.parse({ bosses: await rank(need(), req) }));
  });
  api.post("/suggest-goals", async (c) => {
    const { about } = await body(c, SuggestGoalsRequest);
    return c.json(SuggestGoalsResponse.parse({ goals: pickGoals(await need().facets(about)) }));
  });
  app.route("/api/search", api);

  return app;
}
