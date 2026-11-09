import { type Attendee, type GetAttendeeResponse, type Talk, fixtures } from "@conquest/contracts";
import { describe, expect, it } from "vitest";
import { createApp } from "../app";
import { type Deps, memoryDeps } from "../deps";
import { createFakeSearchClient } from "../search/client";
import { classFromKeywords } from "./classes";
import { FILLER_REASON, MAP_MAX, MAP_MIN } from "./map";

const NOW = new Date("2026-11-09T19:00:00.000Z");

async function setup(over: Partial<Deps> = {}) {
  let n = 0;
  const deps = memoryDeps({ now: () => NOW, newId: () => `id-${++n}`, ...over });
  await deps.repos.conferences.create(fixtures.conference);
  await deps.repos.conferences.create({ ...fixtures.conference, id: "conf-other" });
  const app = createApp(deps);
  const call = async (method: string, path: string, json?: unknown) => {
    const res = await app.request(`/api/game${path}`, {
      method,
      headers: { "content-type": "application/json" },
      body: json === undefined ? undefined : JSON.stringify(json),
    });
    return { status: res.status, json: (await res.json()) as Record<string, unknown> };
  };
  const signup = async (over: Record<string, unknown> = {}) => {
    const res = await call("POST", "/attendees", {
      conference_id: "conf-demo",
      name: "Jane",
      headline: "Staff SRE",
      about: "I run platform teams and care about observability",
      class: "knight",
      avatar_seed: "abcd1234",
      goals: ["Platform Engineering", "Observability"],
      ...over,
    });
    expect(res.status).toBe(200);
    return res.json.attendee as Attendee;
  };
  return { deps, call, signup };
}

describe("LinkedIn is optional", () => {
  it("GM-19 signing up without a LinkedIn link (missing or blank) stores null", async () => {
    const t = await setup();
    expect((await t.signup()).linkedin_url).toBeNull();
    expect((await t.signup({ linkedin_url: "   " })).linkedin_url).toBeNull();
  });

  it("GM-21 an ally without a LinkedIn link shows up with a null link", async () => {
    const t = await setup();
    const jane = await t.signup({ linkedin_url: "linkedin.com/in/jane" });
    const sam = await t.signup({ name: "Sam" });
    expect((await t.call("POST", "/xp", { attendee_id: jane.id, kind: "network", other_code: sam.code })).status).toBe(200);
    const view = (await t.call("GET", `/attendees/${jane.id}`)).json as unknown as GetAttendeeResponse;
    expect(view.allies).toEqual([{ attendee_id: sam.id, name: "Sam", headline: "Staff SRE", linkedin_url: null, photo: null }]);
  });
});

describe("same LinkedIn link returns the existing character", () => {
  it("GM-23 a second signup with the same link, in any pasted form, returns the first attendee unchanged", async () => {
    const t = await setup();
    const first = await t.signup({ linkedin_url: "linkedin.com/in/jane-doe" });
    const again = await t.signup({ linkedin_url: "https://uk.linkedin.com/in/jane-doe/?trk=x", name: "Jane D", class: "bard" });
    expect(again).toEqual(first);
    expect(await t.deps.repos.attendees.count({ conference_id: "conf-demo" })).toBe(1);
  });

  it("GM-23 the same link in another conference is a new attendee", async () => {
    const t = await setup();
    const a = await t.signup({ linkedin_url: "linkedin.com/in/jane-doe" });
    const b = await t.signup({ linkedin_url: "linkedin.com/in/jane-doe", conference_id: "conf-other" });
    expect(b.id).not.toBe(a.id);
  });

  it("GM-23 without a link, every signup is a new attendee", async () => {
    const t = await setup();
    const a = await t.signup();
    const b = await t.signup();
    expect(b.id).not.toBe(a.id);
  });
});

describe("profile edits after signup", () => {
  const jpeg = `data:image/jpeg;base64,${"A".repeat(100)}`;

  it("GM-24 PATCH changes headline, photo and class, and leaves everything else alone", async () => {
    const t = await setup();
    const jane = await t.signup();
    const res = await t.call("PATCH", `/attendees/${jane.id}`, { headline: "Principal SRE", photo: jpeg, class: "wizard" });
    expect(res.status).toBe(200);
    const after = res.json.attendee as Attendee;
    expect(after).toEqual({ ...jane, headline: "Principal SRE", photo: jpeg, class: "wizard" });
    expect(await t.deps.repos.attendees.get(jane.id)).toEqual(after);
  });

  it("GM-24 photo null removes the photo; a bad photo is 400 bad_photo", async () => {
    const t = await setup();
    const jane = await t.signup({ photo: jpeg });
    expect(((await t.call("PATCH", `/attendees/${jane.id}`, { photo: null })).json.attendee as Attendee).photo).toBeNull();
    const bad = await t.call("PATCH", `/attendees/${jane.id}`, { photo: "data:image/png;base64,AAAA" });
    expect(bad.status).toBe(400);
    expect((bad.json.error as { code: string }).code).toBe("bad_photo");
  });

  it("GM-24 goals, map and quests can't be changed through PATCH", async () => {
    const t = await setup();
    const jane = await t.signup();
    const res = await t.call("PATCH", `/attendees/${jane.id}`, { goals: ["Gardening"], map: [], xp: 9999 });
    expect(res.status).toBe(200);
    expect(res.json.attendee).toEqual(jane);
  });

  it("GM-24 PATCH on an unknown attendee is 404", async () => {
    const t = await setup();
    expect((await t.call("PATCH", "/attendees/nope", { headline: "x" })).status).toBe(404);
  });
});

describe("map size", () => {
  const talkAt = (id: string, hh: string, extra: Partial<Talk> = {}): Talk => ({
    id,
    title: `Talk ${id}`,
    abstract: "General session.",
    speaker_ids: [],
    room: "Hall A",
    starts_at: `2026-11-10T${hh}:00:00.000Z`,
    ends_at: `2026-11-10T${hh}:30:00.000Z`,
    track: null,
    level: null,
    tags: [],
    ...extra,
  });

  it("GM-5 a short map is topped up to the minimum with non-clashing talks, in time order", async () => {
    const t = await setup();
    // Niche goals: search finds little, so filler talks fill the gaps.
    const jane = await t.signup({ goals: ["eBPF"], about: "" });
    expect(jane.map.length).toBeGreaterThanOrEqual(MAP_MIN);
    expect(jane.map.length).toBeLessThanOrEqual(MAP_MAX);
    expect(jane.map.some((b) => b.reason === FILLER_REASON)).toBe(true);
    const talks = jane.map.map((b) => fixtures.talks.find((x) => x.id === b.talk_id)!);
    for (let i = 1; i < talks.length; i++) {
      expect(talks[i - 1]!.starts_at <= talks[i]!.starts_at).toBe(true);
      expect(talks[i - 1]!.ends_at <= talks[i]!.starts_at).toBe(true);
    }
  });

  it("GM-5 a small schedule gives a smaller map instead of clashing talks", async () => {
    const schedule = [talkAt("a", "09"), talkAt("b", "10"), talkAt("c", "10"), talkAt("d", "11")];
    const t = await setup({ search: createFakeSearchClient(schedule, []) });
    const jane = await t.signup({ goals: ["Gardening"], about: "" });
    expect(jane.map.map((b) => b.talk_id)).toEqual(["a", "b", "d"]);
  });
});

describe("goal quests", () => {
  it("GM-5 a boss counts for every goal it matches", async () => {
    // talk-4 "OpenTelemetry in Practice" is tagged observability and opentelemetry.
    const t = await setup();
    const jane = await t.signup({ goals: ["Observability", "OpenTelemetry"] });
    const goal = (g: string) => jane.quests.find((q) => q.kind === "goal" && q.title.endsWith(g));
    expect(goal("Observability")?.target.talk_ids).toContain("talk-4");
    expect(goal("OpenTelemetry")?.target.talk_ids).toContain("talk-4");
  });
});

describe("class keywords", () => {
  it("GM-4 the class with the most keyword hits wins, and ties go rogue, knight, wizard", () => {
    expect(classFromKeywords("ML researcher", "data pipelines on the platform team")).toBe("wizard");
    expect(classFromKeywords("AI platform engineer", "")).toBe("knight");
    expect(classFromKeywords("Security SRE", "")).toBe("rogue");
    expect(classFromKeywords("SRE", "on-call for infra and platform; some security reviews")).toBe("knight");
    expect(classFromKeywords("Product designer", "")).toBe("bard");
    // Found in browser testing: plurals count, so this SRE is a knight, not a rogue.
    expect(classFromKeywords("Staff SRE", "I run Kubernetes platforms and care about observability, eBPF and security.")).toBe("knight");
  });
});
