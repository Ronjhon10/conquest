// Routes built in BUILD G.2 (030 Behavior 1-3). Mounted under /api/game by app.ts.
import { type Conference, type ConferenceSummary, CreateConferenceRequest, PutQuestsRequest, PutRoomsRequest, type Quest, type Room } from "@conquest/contracts";
import { Hono } from "hono";
import { defaultQuests, nextQuests, syncAttendeeQuests } from "../conferences/quests";
import { generateTheme } from "../conferences/theme";
import type { Deps } from "../deps";
import { ApiError, body } from "../http";

export function conferencesRoutes(deps: Deps) {
  const r = new Hono();
  const notFound = () => new ApiError(404, "not_found", "Conference not found");

  r.post("/conferences", async (c) => {
    const req = await body(c, CreateConferenceRequest);
    const theme = await generateTheme(deps.llm, req.theme_prompt);
    const conference: Conference = {
      id: deps.newId(),
      name: req.name,
      theme,
      quests: defaultQuests(deps.newId),
      rooms: req.rooms ?? (await roomsFromTalks(deps)),
      created_at: deps.now().toISOString(),
    };
    await deps.repos.conferences.create(conference);
    return c.json({ conference });
  });

  r.get("/conferences", async (c) => {
    const all = await deps.repos.conferences.find({}, { size: 100 });
    const conferences: ConferenceSummary[] = all
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((conf) => ({ id: conf.id, name: conf.name, theme_name: conf.theme.name, created_at: conf.created_at }));
    return c.json({ conferences });
  });

  r.get("/conferences/:id", async (c) => {
    const conference = await deps.repos.conferences.get(c.req.param("id"));
    if (!conference) throw notFound();
    return c.json({ conference });
  });

  r.put("/conferences/:id/quests", async (c) => {
    const req = await body(c, PutQuestsRequest);
    const id = c.req.param("id");
    const before = await deps.repos.conferences.get(id);
    if (!before) throw notFound();
    const quests: Quest[] = nextQuests(before.quests, req.quests, deps.newId);
    const conference = await deps.repos.conferences.update(id, (conf) => ({ ...conf, quests }));
    if (!conference) throw notFound();
    await syncAttendeeQuests(deps, id, before.quests);
    return c.json({ conference });
  });

  r.put("/conferences/:id/rooms", async (c) => {
    const req = await body(c, PutRoomsRequest);
    const conference = await deps.repos.conferences.update(c.req.param("id"), (conf) => ({ ...conf, rooms: req.rooms }));
    if (!conference) throw notFound();
    return c.json({ conference });
  });

  return r;
}

/** 030 Behavior 3: every distinct room in the talks index, all step-free. */
async function roomsFromTalks(deps: Deps): Promise<Room[]> {
  const names = await deps.search.rooms();
  return names.map((name) => ({ name, step_free: true, step_free_note: null }));
}
