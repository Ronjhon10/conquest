import { AttendeeResponse, ConferenceResponse, GetAttendeeResponse, fixtures, INDEX } from "@conquest/contracts";
import { afterEach, expect, it, vi } from "vitest";
import { createApp } from "../app";
import { memoryDeps } from "../deps";
import { createMemoryStore } from "../store/memory";
import { createRepos } from "../store/repos";
import type { DocStore } from "../store/store";

function setup(store: DocStore = createMemoryStore()) {
  let n = 0;
  const deps = memoryDeps({ newId: () => `r2-${++n}` });
  deps.store = store; deps.repos = createRepos(store);
  const app = createApp(deps);
  const send = async (method: string, path: string, body?: unknown) => {
    const res = await app.request(`/api/game${path}`, { method, headers: { "content-type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: res.status, body: await res.json() };
  };
  const signup = (over: object = {}) => send("POST", "/attendees", {
    conference_id: "conf-demo", name: "Test", headline: "SRE", about: "platform", class: "knight", avatar_seed: "seed1234", goals: ["Platform engineering"],
    linkedin_url: "linkedin.com/in/test-person", ...over,
  });
  return { deps, app, send, signup };
}
afterEach(() => vi.restoreAllMocks());

it("GM-23 repeat signup works with a legacy unindexed LinkedIn field", async () => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  const inner = createMemoryStore();
  const legacy: DocStore = { ...inner, find: async (index, filter, opts) => {
    if (index === INDEX.attendees && "linkedin_url" in filter) throw new Error("Cannot search on unindexed field [linkedin_url]");
    return inner.find(index, filter, opts);
  } };
  const { deps, signup } = setup(legacy);
  await deps.repos.conferences.create(fixtures.conference);
  const prior = { ...fixtures.attendee, id: "legacy-random-id", linkedin_url: "https://www.linkedin.com/in/test-person/" };
  await deps.repos.attendees.create(prior);
  const response = await signup();
  expect(response.status).toBe(200);
  expect(AttendeeResponse.parse(response.body).attendee).toEqual(prior);
});

it("GM-23 simultaneous signup with one LinkedIn link creates one character", async () => {
  const { deps, signup } = setup(); await deps.repos.conferences.create(fixtures.conference);
  const responses = await Promise.all([signup(), signup({ linkedin_url: "https://uk.linkedin.com/in/test-person/?trk=x" })]);
  expect(responses.map((r) => r.status)).toEqual([200, 200]);
  expect(AttendeeResponse.parse(responses[0]!.body).attendee.id).toBe(AttendeeResponse.parse(responses[1]!.body).attendee.id);
  expect(await deps.repos.attendees.count()).toBe(1);
});

it("GM-13 a failed gift write is recoverable without losing or charging another coin", async () => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  const inner = createMemoryStore(); let fail = true;
  const store: DocStore = { ...inner, create: async (index, id, doc) => {
    if (index === INDEX.coins && fail) throw new Error("local simulated gift write failure");
    return inner.create(index, id, doc);
  } };
  const { deps, send } = setup(store);
  await deps.repos.conferences.create(fixtures.conference);
  await deps.repos.attendees.create({ ...fixtures.attendee, xp: 0, coins: 3, quests: [] });
  await send("POST", "/xp", { attendee_id: "att-jane", kind: "checkin", talk_id: "talk-3" });
  expect((await send("POST", "/coins", { from_attendee_id: "att-jane", talk_id: "talk-3", note: "Private thanks" })).status).toBe(500);
  fail = false;
  const read = await send("GET", "/attendees/att-jane");
  expect(GetAttendeeResponse.parse(read.body).attendee.coins).toBe(2);
  expect(await deps.repos.coins.count()).toBe(1);
  const retry = await send("POST", "/coins", { from_attendee_id: "att-jane", talk_id: "talk-3", note: "Private thanks" });
  expect(retry.status).toBe(409);
  expect((await deps.repos.attendees.get("att-jane"))?.coins).toBe(2);
});

it("GM-22 concurrent quest replacements never accumulate the other edit's removed quests", async () => {
  const { deps, send } = setup(); await deps.repos.conferences.create(fixtures.conference);
  await deps.repos.attendees.create({ ...fixtures.attendee, quests: fixtures.conference.quests });
  const quest = (title: string) => ({ title, description: title, xp: 10, kind: "organizer", sponsor: null, target: { type: "photo", count: 20, talk_ids: null } });
  const edits = await Promise.all([send("PUT", "/conferences/conf-demo/quests", { quests: [quest("One")] }), send("PUT", "/conferences/conf-demo/quests", { quests: [quest("Two")] })]);
  expect(edits.map((r) => r.status)).toEqual([200, 200]);
  const conf = ConferenceResponse.parse((await send("GET", "/conferences/conf-demo")).body).conference;
  const attendee = GetAttendeeResponse.parse((await send("GET", "/attendees/att-jane")).body).attendee;
  expect(attendee.quests).toEqual(conf.quests);
});

it("GM-23 legacy character lookup continues beyond the first source page", async () => {
  const { deps, signup } = setup(); await deps.repos.conferences.create(fixtures.conference);
  for (let i = 0; i < 105; i++) await deps.repos.attendees.create({ ...fixtures.attendee, id: `old-${String(i).padStart(3, "0")}`, linkedin_url: `https://www.linkedin.com/in/other-${i}/` });
  await deps.repos.attendees.create({ ...fixtures.attendee, id: "zz-legacy", linkedin_url: "https://www.linkedin.com/in/test-person/" });
  expect(AttendeeResponse.parse((await signup()).body).attendee.id).toBe("zz-legacy");
  expect(await deps.repos.attendees.count()).toBe(106);
});

it("GM-13 concurrent gifts and XP updates preserve both journals and the coin balance", async () => {
  const { deps, send } = setup();
  await deps.repos.attendees.create({ ...fixtures.attendee, xp: 0, coins: 3, quests: [] });
  await send("POST", "/xp", { attendee_id: "att-jane", kind: "checkin", talk_id: "talk-3" });
  const responses = await Promise.all([
    send("POST", "/coins", { from_attendee_id: "att-jane", talk_id: "talk-3", note: "Thanks" }),
    send("POST", "/xp", { attendee_id: "att-jane", kind: "photo" }),
  ]);
  expect(responses.map((r) => r.status)).toEqual([200, 200]);
  expect((await deps.repos.attendees.get("att-jane"))).toMatchObject({ coins: 2, xp: 125 });
  expect(await deps.repos.coins.count()).toBe(1);
  expect(await deps.repos.xpEvents.count()).toBe(2);
});
