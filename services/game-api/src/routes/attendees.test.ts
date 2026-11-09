import { Attendee, type XpEvent, fixtures } from "@conquest/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app";
import { classFromKeywords } from "../attendees/classes";
import { CODE_ALPHABET, uniqueCode } from "../attendees/code";
import { normalizeLinkedInUrl } from "../attendees/linkedin";
import { type Deps, memoryDeps } from "../deps";
import { createFakeLlm } from "../llm";

// Test-only loose JSON: responses are checked field by field below.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type J = any;
type Res = { status: number; json(): Promise<J> };

const NOW = new Date("2026-11-10T08:00:00.000Z");

async function setup(over: Partial<Deps> = {}) {
  let n = 0;
  const deps = memoryDeps({ now: () => NOW, newId: () => `id-${++n}`, ...over });
  await deps.repos.conferences.create(fixtures.conference);
  const app = createApp(deps);
  const post = async (path: string, json: unknown): Promise<Res> =>
    app.request(`/api/game${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(json) });
  const get = async (path: string): Promise<Res> => app.request(`/api/game${path}`);
  return { deps, app, post, get };
}

const draftBody = (headline: string, about = "") => ({
  conference_id: "conf-demo",
  name: "Jane",
  headline,
  about,
  linkedin_url: "linkedin.com/in/jane-doe",
});

const createBody = (over: Record<string, unknown> = {}) => ({
  ...draftBody("Staff SRE", "I run platform teams and care about observability"),
  class: "knight",
  avatar_seed: "abcd1234",
  goals: ["Platform Engineering", "Observability"],
  ...over,
});

afterEach(() => vi.unstubAllGlobals());

describe("GM-4 draft", () => {
  it("GM-4 picks the class by keyword rules without OpenAI", async () => {
    const { post } = await setup();
    const cases: [string, string][] = [
      ["Staff SRE", "knight"],
      ["Security engineer", "rogue"],
      ["ML researcher", "wizard"],
      ["Developer advocate", "bard"],
    ];
    for (const [headline, cls] of cases) {
      const res = await post("/attendees/draft", draftBody(headline));
      expect(res.status).toBe(200);
      expect((await res.json()).class, headline).toBe(cls);
    }
  });

  it("GM-4 keyword rules match whole words, case-insensitively", () => {
    expect(classFromKeywords("DevOps lead", "")).toBe("knight");
    expect(classFromKeywords("", "I work on COMPLIANCE")).toBe("rogue");
    expect(classFromKeywords("Barista", "I love hops and flowers")).toBe("bard");
    expect(classFromKeywords("Developer advocate", "")).toBe("bard");
  });

  it("GM-4 returns suggested goals from search, a random 8-char avatar seed, and saves nothing", async () => {
    const { post, deps } = await setup();
    const a = await (await post("/attendees/draft", draftBody("Staff SRE", "platform observability"))).json();
    const b = await (await post("/attendees/draft", draftBody("Staff SRE", "platform observability"))).json();
    expect(a.suggested_goals).toEqual(await deps.search.suggestGoals("platform observability"));
    expect(a.avatar_seed).toMatch(/^[a-z0-9]{8}$/);
    expect(a.avatar_seed).not.toBe(b.avatar_seed);
    expect(await deps.repos.attendees.count()).toBe(0);
  });

  it("GM-4 uses the OpenAI class when valid, and the keyword rules when it is not", async () => {
    const good = createFakeLlm(() => ({ class: "wizard" }));
    const s1 = await setup({ llm: good.llm });
    expect((await (await s1.post("/attendees/draft", draftBody("Staff SRE"))).json()).class).toBe("wizard");
    expect(good.requests[0]?.purpose).toBe("class");

    const bad = createFakeLlm(() => ({ class: "paladin" }));
    const s2 = await setup({ llm: bad.llm });
    expect((await (await s2.post("/attendees/draft", draftBody("Staff SRE"))).json()).class).toBe("knight");
  });
});

describe("GM-5 create", () => {
  it("GM-5 a new attendee has xp 0, level 1, coins 3, a valid code, a map from rank and one goal quest per goal with a boss", async () => {
    const { post, deps } = await setup();
    const res = await post("/attendees", createBody({ goals: ["Platform Engineering", "Observability", "Quantum Gardening"] }));
    expect(res.status).toBe(200);
    const { attendee } = await res.json();
    expect(Attendee.parse(attendee)).toEqual(attendee);
    expect(attendee).toMatchObject({ xp: 0, level: 1, coins: 3, party_id: null, created_at: NOW.toISOString() });
    expect(attendee.code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    expect([...attendee.code].every((ch: string) => CODE_ALPHABET.includes(ch))).toBe(true);

    const expectedMap = await deps.search.rank({
      goals: ["Platform Engineering", "Observability", "Quantum Gardening"],
      about: "I run platform teams and care about observability",
      limit: 6,
    });
    expect(attendee.map).toEqual(expectedMap);
    expect(attendee.map.length).toBeGreaterThan(0);

    const goalQuests = attendee.quests.filter((q: { kind: string }) => q.kind === "goal");
    expect(goalQuests.map((q: { title: string }) => q.title)).toEqual([
      "Defeat the boss of Platform Engineering",
      "Defeat the boss of Observability",
    ]);
    expect(goalQuests[0]).toMatchObject({ xp: 100, sponsor: null, target: { type: "checkin", count: 1, talk_ids: ["talk-1"] } });
    expect(goalQuests[1].target.talk_ids).toEqual(expect.arrayContaining(["talk-2"]));
    // goal quests first, then the conference's quests
    expect(attendee.quests.slice(goalQuests.length)).toEqual(fixtures.conference.quests);
    expect(await deps.repos.attendees.get(attendee.id)).toEqual(attendee);
  });

  it("GM-5 codes are unique within a conference (retries on collision)", async () => {
    const codes = ["AAAAAA", "AAAAAA", "BBBBBB"];
    const taken = new Set(["AAAAAA"]);
    expect(await uniqueCode(async (c) => taken.has(c), () => codes.shift() as string)).toBe("BBBBBB");

    const { post } = await setup();
    const seen = new Set<string>();
    for (let i = 0; i < 20; i++) seen.add((await (await post("/attendees", createBody())).json()).attendee.code);
    expect(seen.size).toBe(20);
  });

  it("GM-5 an unknown conference is 404 not_found", async () => {
    const { post } = await setup();
    const res = await post("/attendees", createBody({ conference_id: "nope" }));
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe("not_found");
  });

  it("GM-5 GET /attendees/:id returns the attendee, their party and 404 when missing", async () => {
    const { post, get, deps } = await setup();
    const { attendee } = await (await post("/attendees", createBody())).json();
    await deps.repos.parties.create({ id: "party-1", conference_id: "conf-demo", name: "The Crew", member_ids: [attendee.id] });
    await deps.repos.attendees.update(attendee.id, (a) => ({ ...a, party_id: "party-1" }));
    const got = await (await get(`/attendees/${attendee.id}`)).json();
    expect(got.attendee.id).toBe(attendee.id);
    expect(got.party.name).toBe("The Crew");
    expect(got.allies).toEqual([]);
    const missing = await get("/attendees/nope");
    expect(missing.status).toBe(404);
    expect((await missing.json()).error.code).toBe("not_found");
  });
});

describe("GM-19 LinkedIn URLs", () => {
  it("GM-19 variants all store the normalized profile URL", async () => {
    const { post } = await setup();
    for (const url of [
      "linkedin.com/in/jane-doe",
      "https://uk.linkedin.com/in/jane-doe/?trk=x",
      "www.linkedin.com/in/jane-doe/",
      "  HTTP://WWW.LINKEDIN.COM/in/jane-doe#top ",
    ]) {
      const res = await post("/attendees", createBody({ linkedin_url: url }));
      expect(res.status, url).toBe(200);
      expect((await res.json()).attendee.linkedin_url).toBe("https://www.linkedin.com/in/jane-doe/");
    }
  });

  it("GM-19 a non-profile URL is 400 bad_linkedin_url", async () => {
    const { post, deps } = await setup();
    for (const url of ["linkedin.com/company/x", "example.com", "https://example.com/in/jane-doe", "linkedin.com/in/", "https://evil.com/?u=linkedin.com/in/jane"]) {
      const res = await post("/attendees", createBody({ linkedin_url: url }));
      expect(res.status, url).toBe(400);
      expect((await res.json()).error.code).toBe("bad_linkedin_url");
    }
    expect(await deps.repos.attendees.count()).toBe(0);
    expect(normalizeLinkedInUrl("linkedin.com/in/a/b")).toBeNull();
  });

  it("GM-19 never makes a network request", async () => {
    const fetchSpy = vi.fn(() => {
      throw new Error("network is off");
    });
    vi.stubGlobal("fetch", fetchSpy);
    const { post } = await setup();
    expect((await post("/attendees", createBody({ linkedin_url: "linkedin.com/in/jane-doe" }))).status).toBe(200);
    expect((await post("/attendees", createBody({ linkedin_url: "example.com" }))).status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("GM-20 photo", () => {
  const jpeg = (size: number) => `data:image/jpeg;base64,${"A".repeat(size - "data:image/jpeg;base64,".length)}`;

  it("GM-20 a photo that is not a JPEG data URL, or is over 40 KB, is 400 bad_photo", async () => {
    const { post, deps } = await setup();
    for (const photo of ["data:image/png;base64,AAAA", "https://example.com/me.jpg", "", jpeg(40 * 1024 + 1)]) {
      const res = await post("/attendees", createBody({ photo }));
      expect(res.status, photo.slice(0, 30)).toBe(400);
      expect((await res.json()).error.code).toBe("bad_photo");
    }
    expect(await deps.repos.attendees.count()).toBe(0);
  });

  it("GM-20 a valid photo (up to 40 KB) is returned on the attendee, and no photo is null", async () => {
    const { post, get } = await setup();
    const photo = jpeg(40 * 1024);
    const { attendee } = await (await post("/attendees", createBody({ photo }))).json();
    expect(attendee.photo).toBe(photo);
    expect((await (await get(`/attendees/${attendee.id}`)).json()).attendee.photo).toBe(photo);
    expect((await (await post("/attendees", createBody())).json()).attendee.photo).toBeNull();
  });
});

describe("GM-21 allies", () => {
  it("GM-21 after two attendees network, each one's allies contains the other with their LinkedIn link", async () => {
    const { post, get, deps } = await setup();
    const jane = (await (await post("/attendees", createBody({ name: "Jane", linkedin_url: "linkedin.com/in/jane-doe" }))).json()).attendee;
    const sam = (await (await post("/attendees", createBody({ name: "Sam", headline: "Developer advocate", linkedin_url: "linkedin.com/in/sam-s" }))).json()).attendee;

    const event = (id: string, who: string, other: string): XpEvent => ({
      id,
      conference_id: "conf-demo",
      attendee_id: who,
      kind: "network",
      talk_id: null,
      other_attendee_id: other,
      quest_id: null,
      party_id: null,
      base_xp: 50,
      multiplier: 1,
      xp: 50,
      at: NOW.toISOString(),
    });
    await deps.repos.xpEvents.create(event("e1", jane.id, sam.id));
    await deps.repos.xpEvents.create(event("e2", sam.id, jane.id));
    // a duplicate event for the same pair must not duplicate the ally
    await deps.repos.xpEvents.create(event("e3", jane.id, sam.id));

    const janeView = await (await get(`/attendees/${jane.id}`)).json();
    expect(janeView.allies).toEqual([
      { attendee_id: sam.id, name: "Sam", headline: "Developer advocate", linkedin_url: "https://www.linkedin.com/in/sam-s/", photo: null },
    ]);
    const samView = await (await get(`/attendees/${sam.id}`)).json();
    expect(samView.allies.map((a: { attendee_id: string; linkedin_url: string }) => [a.attendee_id, a.linkedin_url])).toEqual([
      [jane.id, "https://www.linkedin.com/in/jane-doe/"],
    ]);
  });
});
