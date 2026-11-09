import { PHOTO_LIMIT } from "../xp/rules";
import { fixtures, GetAttendeeResponse, INDEX, LeaderboardResponse, PartyResponse, type Attendee, type XpEvent } from "@conquest/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app";
import { memoryDeps } from "../deps";
import { createMemoryStore } from "../store/memory";
import { createRepos } from "../store/repos";
import { createMemoryStats } from "../stats/memory";
import { type DocStore, VersionConflictError } from "../store/store";

function setup(store: DocStore = createMemoryStore()) {
  let next = 0;
  function instance() {
    const deps = memoryDeps({ newId: () => `concurrent-${++next}` });
    deps.store = store;
    deps.repos = createRepos(store);
    deps.stats = createMemoryStats(deps.repos);
    return { deps, app: createApp(deps) };
  }
  const one = instance();
  const two = instance(); // Independent service objects, sharing only the datastore.
  const post = async (path: string, body: unknown, other = false) => {
    const res = await (other ? two : one).app.request(`/api/game${path}`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
    });
    return { status: res.status, body: await res.json() };
  };
  const seed = (id: string, code: string, over: Partial<Attendee> = {}) => one.deps.repos.attendees.create({
    ...fixtures.attendee, id, code, xp: 0, level: 1, coins: 3, party_id: null, quests: [], ...over,
  });
  return { ...one, two, post, seed, instance };
}

afterEach(() => vi.restoreAllMocks());

describe("concurrent player mutations across service instances", () => {
  it("GM-17 eight parallel awards keep attendee XP and event totals equal", async () => {
    const { deps, post, seed } = setup();
    await seed("a", "AAAAAA");
    // Four photos and four check-ins on different talks, all at once (the photo cap is 6).
    const award = (i: number) => (i < 4 ? { attendee_id: "a", kind: "photo" } : { attendee_id: "a", kind: "checkin", talk_id: `talk-${i - 3}` });
    const responses = await Promise.all(Array.from({ length: 8 }, (_, i) => post("/xp", award(i), i % 2 === 0)));
    expect(responses.map((r) => r.status)).toEqual(Array(8).fill(200));
    const events = await deps.repos.xpEvents.find({ attendee_id: "a" });
    expect(events).toHaveLength(8);
    expect((await deps.repos.attendees.get("a"))?.xp).toBe(events.reduce((sum, e) => sum + e.xp, 0));
  });

  it("GM-6 racing duplicate boss check-ins pay XP and the bonus coin exactly once", async () => {
    const { deps, post, seed } = setup();
    await seed("a", "AAAAAA");
    const req = { attendee_id: "a", kind: "checkin", talk_id: "talk-1" };
    const responses = await Promise.all([post("/xp", req), post("/xp", req, true)]);
    expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
    expect((await deps.repos.attendees.get("a"))).toMatchObject({ xp: 150, coins: 4 });
    expect(await deps.repos.xpEvents.count({ attendee_id: "a" })).toBe(1);
  });

  it("GM-8 racing photos cannot consume the final photo slot twice", async () => {
    const { deps, post, seed } = setup();
    await seed("a", "AAAAAA");
    for (let i = 0; i < PHOTO_LIMIT - 1; i++) expect((await post("/xp", { attendee_id: "a", kind: "photo" })).status).toBe(200);
    const responses = await Promise.all([post("/xp", { attendee_id: "a", kind: "photo" }), post("/xp", { attendee_id: "a", kind: "photo" }, true)]);
    expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await deps.repos.xpEvents.count({ attendee_id: "a", kind: "photo" })).toBe(PHOTO_LIMIT);
    expect((await deps.repos.attendees.get("a"))?.xp).toBe(PHOTO_LIMIT * 25);
  });

  it("GM-9 simultaneous networking in opposite directions pays each attendee once", async () => {
    const { deps, post, seed } = setup();
    await seed("a", "AAAAAA"); await seed("b", "BBBBBB");
    const responses = await Promise.all([
      post("/xp", { attendee_id: "a", kind: "network", other_code: "BBBBBB" }),
      post("/xp", { attendee_id: "b", kind: "network", other_code: "AAAAAA" }, true),
    ]);
    expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await deps.repos.xpEvents.count({ kind: "network" })).toBe(2);
    for (const id of ["a", "b"]) expect((await deps.repos.attendees.get(id))?.xp).toBe(50);
  });

  it("GM-10 simultaneous quest completion pays a quest exactly once", async () => {
    const { deps, post, seed } = setup();
    await seed("a", "AAAAAA", { quests: [{ id: "q", title: "Q", description: "Q", xp: 75, kind: "organizer", sponsor: null,
      target: { type: "photo", count: 1, talk_ids: null } }] });
    const responses = await Promise.all([post("/xp", { attendee_id: "a", kind: "photo" }), post("/xp", { attendee_id: "a", kind: "photo" }, true)]);
    expect(responses.map((r) => r.status)).toEqual([200, 200]);
    expect(await deps.repos.xpEvents.count({ kind: "quest" })).toBe(1);
    expect((await deps.repos.attendees.get("a"))?.xp).toBe(125);
  });

  it("GM-12 concurrent creation cannot put one attendee in two parties", async () => {
    const { deps, post, seed } = setup(); await seed("a", "AAAAAA");
    const rs = await Promise.all([post("/parties", { attendee_id: "a", name: "One" }), post("/parties", { attendee_id: "a", name: "Two" }, true)]);
    expect(rs.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await deps.repos.parties.count()).toBe(1);
    expect((await deps.repos.parties.find())[0]?.id).toBe((await deps.repos.attendees.get("a"))?.party_id);
  });

  it("GM-12 simultaneous joins to different parties claim the attendee only once", async () => {
    const { deps, post, seed } = setup();
    await seed("a", "AAAAAA"); await seed("b", "BBBBBB"); await seed("c", "CCCCCC");
    const p1 = PartyResponse.parse((await post("/parties", { attendee_id: "b", name: "One" })).body).party;
    const p2 = PartyResponse.parse((await post("/parties", { attendee_id: "c", name: "Two" })).body).party;
    const rs = await Promise.all([post(`/parties/${p1.id}/join`, { attendee_id: "a" }), post(`/parties/${p2.id}/join`, { attendee_id: "a" }, true)]);
    expect(rs.map((r) => r.status).sort()).toEqual([200, 409]);
    const memberships = await deps.repos.parties.find({ member_ids: "a" });
    expect(memberships).toHaveLength(1);
    expect(memberships[0]?.id).toBe((await deps.repos.attendees.get("a"))?.party_id);
  });

  it("GM-12 failing to join a full party releases the attendee claim", async () => {
    const { deps, post, seed } = setup(); await seed("a", "AAAAAA");
    await deps.repos.parties.create({ id: "full", name: "Full", conference_id: "conf-demo", member_ids: ["b", "c", "d", "e"] });
    expect((await post("/parties/full/join", { attendee_id: "a" })).status).toBe(409);
    expect((await deps.repos.attendees.get("a"))?.party_id).toBeNull();
    expect((await post("/parties", { attendee_id: "a", name: "Available" })).status).toBe(200);
  });
});

describe("durable XP publication", () => {
  it("GM-17 exhausted attendee conflicts never publish an event or change XP", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const inner = createMemoryStore();
    const { deps, post, seed } = setup({ ...inner, put: async (index, id) => { throw new VersionConflictError(index, id); } });
    await seed("a", "AAAAAA");
    expect((await post("/xp", { attendee_id: "a", kind: "photo" })).status).toBe(500);
    expect(await deps.repos.xpEvents.count()).toBe(0);
    expect((await deps.repos.attendees.get("a"))?.xp).toBe(0);
  });

  it("GM-17 restart replays a failed event write without double-paying XP or leaking metadata", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const inner = createMemoryStore(); let fail = true;
    const store: DocStore = { ...inner, create: async (index, id, doc) => {
      if (index === INDEX.xpEvents && fail) throw new Error("local simulated write failure");
      return inner.create(index, id, doc);
    } };
    const { deps, post, seed, instance } = setup(store); await seed("a", "AAAAAA");
    expect((await post("/xp", { attendee_id: "a", kind: "checkin", talk_id: "talk-1" })).status).toBe(500);
    expect((await deps.repos.attendees.get("a"))?.xp).toBe(150);
    expect(await deps.repos.xpEvents.count()).toBe(0);
    // A normal repository update must preserve the pending outbox.
    expect((await post("/parties", { attendee_id: "a", name: "Party" })).status).toBe(200);
    fail = false;
    const restarted = instance();
    const response = await restarted.app.request("/api/game/attendees/a");
    expect(response.status).toBe(200);
    const raw = await response.json();
    const body = GetAttendeeResponse.parse(raw);
    expect(body.attendee.xp).toBe(150);
    expect(raw).not.toHaveProperty("attendee._xp_journal");
    expect(raw).not.toHaveProperty("attendee._xp_pending");
    expect(await deps.repos.xpEvents.count()).toBe(1);
    expect((await post("/xp", { attendee_id: "a", kind: "checkin", talk_id: "talk-1" })).status).toBe(409);
    expect((await deps.repos.attendees.get("a"))?.coins).toBe(4);
  });

  it("GM-14 leaderboard reads replay pending events before aggregating XP", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const inner = createMemoryStore(); let fail = true;
    const store: DocStore = { ...inner, create: async (index, id, doc) => {
      if (index === INDEX.xpEvents && fail) throw new Error("local simulated write failure");
      return inner.create(index, id, doc);
    } };
    const { deps, app, post, seed } = setup(store); await seed("a", "AAAAAA");
    await deps.repos.conferences.create(fixtures.conference);
    await post("/xp", { attendee_id: "a", kind: "photo" });
    fail = false;
    const res = await app.request("/api/game/conferences/conf-demo/leaderboard");
    expect(res.status).toBe(200);
    expect(LeaderboardResponse.parse(await res.json()).rows[0]).toMatchObject({ attendee_id: "a", xp: 25 });
  });

  it("GM-17 a lost event-write response is replayed idempotently", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const inner = createMemoryStore(); let fail = true;
    const store: DocStore = { ...inner, create: async (index, id, doc) => {
      const result = await inner.create(index, id, doc);
      if (index === INDEX.xpEvents && fail) { fail = false; throw new Error("local lost response"); }
      return result;
    } };
    const { deps, app, post, seed } = setup(store); await seed("a", "AAAAAA");
    await post("/xp", { attendee_id: "a", kind: "photo" });
    expect((await app.request("/api/game/attendees/a")).status).toBe(200);
    expect(await deps.repos.xpEvents.count()).toBe(1);
    expect((await deps.repos.attendees.get("a"))?.xp).toBe(25);
    const events = await deps.repos.xpEvents.find() as XpEvent[];
    expect(events[0]?.xp).toBe(25);
  });
});
