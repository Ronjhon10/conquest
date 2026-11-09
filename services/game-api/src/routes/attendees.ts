// Routes built in BUILD G.3 (030 Behavior 4-5, allies). Mounted under /api/game by app.ts.
import {
  type Ally,
  type Attendee,
  CharacterClass,
  CreateAttendeeRequest,
  DraftAttendeeRequest,
  type DraftAttendeeResponse,
  type GetAttendeeResponse,
  UpdateAttendeeRequest,
} from "@conquest/contracts";
import { Hono } from "hono";
import { z } from "zod";
import { classFromKeywords } from "../attendees/classes";
import { randomAvatarSeed, uniqueCode } from "../attendees/code";
import { buildMap, goalQuests } from "../attendees/map";
import { normalizeLinkedInUrl } from "../attendees/linkedin";
import type { Deps } from "../deps";
import { ApiError, body } from "../http";
import { publishPendingAwards } from "../xp/journal";
import { existingLinkedAttendee, linkedAttendeeId } from "../attendees/identity";
import { AlreadyExistsError } from "../store/store";

const MAX_PHOTO = 40 * 1024;
const PHOTO_PREFIX = "data:image/jpeg;base64,";

function checkPhoto(photo: string | null | undefined) {
  if (photo && (!photo.startsWith(PHOTO_PREFIX) || photo.length > MAX_PHOTO)) {
    throw new ApiError(400, "bad_photo", "Photo must be a JPEG data URL of at most 40 KB");
  }
  if (photo === "") throw new ApiError(400, "bad_photo", "Photo must be a JPEG data URL of at most 40 KB");
}

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

    // LinkedIn is optional; when given it must be a profile link (GM-19).
    const pasted = req.linkedin_url?.trim() ?? "";
    const linkedin_url = pasted ? normalizeLinkedInUrl(pasted) : null;
    if (pasted && !linkedin_url) {
      throw new ApiError(400, "bad_linkedin_url", "Use a LinkedIn profile link like linkedin.com/in/your-name");
    }
    checkPhoto(req.photo);

    // Signing up again with the same link (a new phone, a cleared browser) returns the same character.
    if (linkedin_url) {
      const existing = await existingLinkedAttendee(deps, conference.id, linkedin_url);
      if (existing) return c.json({ attendee: existing });
    }

    const { map, talks } = await buildMap(deps, req.goals, req.about);
    const quests = goalQuests(deps, req.goals, map, talks, conference.theme.boss_noun);

    const code = await uniqueCode(
      async (code) => (await deps.repos.attendees.find({ conference_id: conference.id, code }, { size: 1 })).length > 0,
    );
    const attendee: Attendee = {
      id: linkedin_url ? linkedAttendeeId(conference.id, linkedin_url) : deps.newId(),
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
      quests: [...quests, ...conference.quests],
      created_at: deps.now().toISOString(),
    };
    try {
      await deps.repos.attendees.create(attendee);
    } catch (err) {
      if (!(err instanceof AlreadyExistsError) || !linkedin_url) throw err;
      const existing = await deps.repos.attendees.get(attendee.id);
      if (!existing) throw err;
      return c.json({ attendee: existing });
    }
    return c.json({ attendee });
  });

  // Profile edits after signup: headline, photo and class. Goals are fixed, so the map and quests stay put.
  r.patch("/attendees/:id", async (c) => {
    const req = await body(c, UpdateAttendeeRequest);
    checkPhoto(req.photo);
    const attendee = await deps.repos.attendees.update(c.req.param("id"), (a) => ({
      ...a,
      ...(req.headline !== undefined ? { headline: req.headline } : {}),
      ...(req.photo !== undefined ? { photo: req.photo } : {}),
      ...(req.class !== undefined ? { class: req.class } : {}),
    }));
    if (!attendee) throw new ApiError(404, "not_found", "No such attendee");
    return c.json({ attendee });
  });

  r.get("/attendees/:id", async (c) => {
    await publishPendingAwards(deps, c.req.param("id"));
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
