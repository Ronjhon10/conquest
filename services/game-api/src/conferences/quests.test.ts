import type { Attendee, Conference, Quest } from "@conquest/contracts";
import { describe, expect, it } from "vitest";
import { createApp } from "../app";
import { memoryDeps } from "../deps";

function setup() {
  let n = 0;
  const deps = memoryDeps({ now: () => new Date("2026-11-09T19:00:00.000Z"), newId: () => `id-${++n}` });
  const app = createApp(deps);
  const send = async <T>(method: string, path: string, body?: unknown): Promise<T> => {
    const res = await app.request(`/api/game${path}`, {
      method,
      headers: { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    expect(res.status, `${method} ${path}`).toBe(200);
    return (await res.json()) as T;
  };
  const conference = async () => (await send<{ conference: Conference }>("POST", "/conferences", { name: "Demo Con", theme_prompt: "caves" })).conference;
  const attendee = async (conference_id: string, name: string) =>
    (
      await send<{ attendee: Attendee }>("POST", "/attendees", {
        conference_id,
        name,
        headline: "Staff SRE",
        about: "observability and platform",
        linkedin_url: `linkedin.com/in/${name.toLowerCase()}`,
        class: "knight",
        avatar_seed: "abcd1234",
        goals: ["Observability"],
      })
    ).attendee;
  const putQuests = async (conferenceId: string, quests: (Omit<Quest, "id"> & { id?: string })[]) =>
    (await send<{ conference: Conference }>("PUT", `/conferences/${conferenceId}/quests`, { quests })).conference;
  const photo = (attendee_id: string) => send("POST", "/xp", { attendee_id, kind: "photo" });
  const get = async (id: string) => (await send<{ attendee: Attendee }>("GET", `/attendees/${id}`)).attendee;
  return { deps, conference, attendee, putQuests, photo, get };
}

const photoQuest = (count: number, xp = 75) => ({
  title: "Capture the moment",
  description: "Take photos.",
  xp,
  kind: "organizer" as const,
  sponsor: null,
  target: { type: "photo" as const, count, talk_ids: null },
});

describe("quest edits reach every attendee", () => {
  it("GM-22 a quest added after signup shows up on existing attendees, and earlier progress counts", async () => {
    const t = setup();
    const conf = await t.conference();
    const jo = await t.attendee(conf.id, "Jo");
    await t.photo(jo.id);
    await t.photo(jo.id);
    const sponsor = { ...photoQuest(2, 40), title: "Visit Acme", kind: "sponsor" as const, sponsor: "Acme" };
    const updated = await t.putQuests(conf.id, [...conf.quests, sponsor]);
    const after = await t.get(jo.id);
    const added = updated.quests.find((q) => q.title === "Visit Acme")!;
    expect(after.quests.map((q) => q.id)).toContain(added.id);
    // Two photos already taken meet the new quest's target, so it pays out right away.
    expect(after.xp).toBe(25 * 2 + 40);
  });

  it("GM-22 attendees keep their own goal quests when the organizer edits quests", async () => {
    const t = setup();
    const conf = await t.conference();
    const jo = await t.attendee(conf.id, "Jo");
    const goalQuests = jo.quests.filter((q) => q.kind === "goal");
    expect(goalQuests.length).toBeGreaterThan(0);
    await t.putQuests(conf.id, [photoQuest(3)]);
    const after = await t.get(jo.id);
    expect(after.quests.filter((q) => q.kind === "goal")).toEqual(goalQuests);
    expect(after.quests.filter((q) => q.kind !== "goal").map((q) => q.title)).toEqual(["Capture the moment"]);
  });

  it("GM-22 editing a quest in place keeps its id, and a finished quest isn't paid twice", async () => {
    const t = setup();
    const conf = await t.conference();
    const jo = await t.attendee(conf.id, "Jo");
    for (let i = 0; i < 3; i++) await t.photo(jo.id); // finishes "Capture the moment" (75 XP)
    expect((await t.get(jo.id)).xp).toBe(75 + 75);
    const capture = conf.quests.find((q) => q.title === "Capture the moment")!;
    const updated = await t.putQuests(
      conf.id,
      conf.quests.map((q) => (q.id === capture.id ? { ...q, description: "Share three photos." } : q)),
    );
    expect(updated.quests.map((q) => q.id)).toEqual(conf.quests.map((q) => q.id));
    const after = await t.get(jo.id);
    expect(after.xp).toBe(75 + 75);
    expect(after.quests.find((q) => q.id === capture.id)?.description).toBe("Share three photos.");
  });

  it("GM-22 removing a quest keeps the XP already earned from it", async () => {
    const t = setup();
    const conf = await t.conference();
    const jo = await t.attendee(conf.id, "Jo");
    for (let i = 0; i < 3; i++) await t.photo(jo.id);
    const capture = conf.quests.find((q) => q.title === "Capture the moment")!;
    await t.putQuests(conf.id, conf.quests.filter((q) => q.id !== capture.id));
    const after = await t.get(jo.id);
    expect(after.quests.map((q) => q.id)).not.toContain(capture.id);
    expect(after.xp).toBe(75 + 75);
  });

  it("GM-22 an id that isn't one of the conference's quests gets a fresh one", async () => {
    const t = setup();
    const conf = await t.conference();
    const updated = await t.putQuests(conf.id, [{ ...photoQuest(1), id: "made-up" }]);
    expect(updated.quests[0]?.id).not.toBe("made-up");
  });
});
