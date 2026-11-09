// Routes built in BUILD G.3 (030 Behavior 4-5, allies). Mounted under /api/game by app.ts.
import {
  type Ally,
  type Attendee,
  CharacterClass,
  CreateAttendeeRequest,
  DraftAttendeeRequest,
  type DraftAttendeeResponse,
  type GetAttendeeResponse,
  type Quest,
} from "@conquest/contracts";
import { Hono } from "hono";
import { z } from "zod";
import { classFromKeywords } from "../attendees/classes";
import { randomAvatarSeed, uniqueCode } from "../attendees/code";
import { normalizeLinkedInUrl } from "../attendees/linkedin";
import type { Deps } from "../deps";
import { ApiError, body } from "../http";

const MAX_PHOTO = 40 * 1024;
const PHOTO_PREFIX = "data:image/jpeg;base64,";

export function attendeesRoutes(deps: Deps) {
  const r = new Hono();

  async function pickClass(headline: string, about: string): Promise<CharacterClass> {
    const fromLlm = deps.llm
      ? await deps.llm
          .json(
            {
              purpose: "class",
              system:
                'Pick the fantasy class that best fits a conference attendee: knight (platform/infra/SRE/ops), wizard (data/ML/AI/research), rogue (security/compliance) or bard (anything else). Answer JSON: {"class": "<class>"}.',
              user: `Headline: ${headline}\nAbout: ${about}`,
            },
            z.object({ class: CharacterClass }),
          )
          .catch(() => null)
      : null;
    return fromLlm?.class ?? classFromKeywords(headline, about);
  }

  r.post("/attendees/draft", async (c) => {
    const req = await body(c, DraftAttendeeRequest);
    const [suggested_goals, cls] = await Promise.all([deps.search.suggestGoals(req.about), pickClass(req.headline, req.about)]);
    const res: DraftAttendeeResponse = { class: cls, avatar_seed: randomAvatarSeed(), suggested_goals };
    return c.json(res);
  });

  r.post("/attendees", async (c) => {
    const req = await body(c, CreateAttendeeRequest);
    const conference = await deps.repos.conferences.get(req.conference_id);
    if (!conference) throw new ApiError(404, "not_found", "No such conference");

    const linkedin_url = normalizeLinkedInUrl(req.linkedin_url);
    if (!linkedin_url) throw new ApiError(400, "bad_linkedin_url", "Use a LinkedIn profile link like linkedin.com/in/your-name");

    if (req.photo !== undefined && (!req.photo.startsWith(PHOTO_PREFIX) || req.photo.length > MAX_PHOTO)) {
      throw new ApiError(400, "bad_photo", "Photo must be a JPEG data URL of at most 40 KB");
    }

    const map = await deps.search.rank({ goals: req.goals, about: req.about, limit: 6 });
    const noun = conference.theme.boss_noun;
    const goalQuests: Quest[] = [];
    for (const goal of req.goals) {
      const needle = goal.trim().toLowerCase();
      if (!needle) continue;
      const talk_ids = map.filter((b) => b.reason.toLowerCase().includes(needle)).map((b) => b.talk_id);
      if (talk_ids.length === 0) continue;
      goalQuests.push({
        id: deps.newId(),
        title: `Defeat the ${noun} of ${goal}`,
        description: `Check in to a talk that matches your goal: ${goal}.`,
        xp: 100,
        kind: "goal",
        sponsor: null,
        target: { type: "checkin", count: 1, talk_ids },
      });
    }

    const code = await uniqueCode(
      async (code) => (await deps.repos.attendees.find({ conference_id: conference.id, code }, { size: 1 })).length > 0,
    );
    const attendee: Attendee = {
      id: deps.newId(),
      conference_id: conference.id,
      name: req.name,
      headline: req.headline,
      linkedin_url,
      photo: req.photo ?? null,
      class: req.class,
      avatar_seed: req.avatar_seed,
      goals: req.goals,
      code,
      party_id: null,
      xp: 0,
      level: 1,
      coins: 3,
      map,
      quests: [...goalQuests, ...conference.quests],
      created_at: deps.now().toISOString(),
    };
    await deps.repos.attendees.create(attendee);
    return c.json({ attendee });
  });

  r.get("/attendees/:id", async (c) => {
    const attendee = await deps.repos.attendees.get(c.req.param("id"));
    if (!attendee) throw new ApiError(404, "not_found", "No such attendee");
    const party = attendee.party_id ? await deps.repos.parties.get(attendee.party_id) : null;

    const events = await deps.repos.xpEvents.find({ attendee_id: attendee.id, kind: "network" });
    const otherIds = [...new Set(events.flatMap((e) => (e.other_attendee_id ? [e.other_attendee_id] : [])))];
    const others = await Promise.all(otherIds.map((id) => deps.repos.attendees.get(id)));
    const allies: Ally[] = others.flatMap((o) =>
      o ? [{ attendee_id: o.id, name: o.name, headline: o.headline, linkedin_url: o.linkedin_url, photo: o.photo }] : [],
    );

    const res: GetAttendeeResponse = { attendee, party, allies };
    return c.json(res);
  });

  return r;
}
