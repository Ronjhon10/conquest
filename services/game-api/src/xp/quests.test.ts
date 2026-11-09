import { type Attendee, fixtures, type Quest, XpResponse } from "@conquest/contracts";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../app";
import { type Deps, memoryDeps } from "../deps";
import { checkQuests } from "./award";

function setup() {
  let n = 0;
  const deps = memoryDeps({ now: () => new Date("2026-11-09T19:00:00.000Z"), newId: () => `id-${++n}` });
  const app = createApp(deps);
  const post = async (payload: unknown) => {
    const res = await app.request("/api/game/xp", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "content-type": "application/json" },
    });
    return { res, json: (await res.json()) as unknown };
  };
  return { deps, post };
}

const quest = (
  id: string,
  xp: number,
  type: Quest["target"]["type"],
  count: number,
  talk_ids: string[] | null,
  kind: Quest["kind"] = "organizer",
): Quest => ({ id, title: id, description: id, xp, kind, sponsor: null, target: { type, count, talk_ids } });

async function seed(deps: Deps, id: string, code: string, quests: Quest[]) {
  return deps.repos.attendees.create({
    ...fixtures.attendee,
    id,
    code,
    xp: 0,
    level: 1,
    coins: 3,
    party_id: null,
    quests,
  } as Attendee);
}
const questEvents = (deps: Deps, id: string) => deps.repos.xpEvents.find({ attendee_id: id, kind: "quest" });

describe("quest completion", () => {
  it("GM-10 reaching the target awards quest XP exactly once", async () => {
    const { deps, post } = setup();
    await seed(deps, "a1", "AAAAAA", [quest("q-photo2", 80, "photo", 2, null)]);
    await post({ attendee_id: "a1", kind: "photo" });
    expect(await questEvents(deps, "a1")).toHaveLength(0);
    await post({ attendee_id: "a1", kind: "photo" });
    const evs = await questEvents(deps, "a1");
    expect(evs).toHaveLength(1);
    expect(evs[0]).toMatchObject({ quest_id: "q-photo2", xp: 80, base_xp: 80, multiplier: 1 });
    await post({ attendee_id: "a1", kind: "photo" });
    await post({ attendee_id: "a1", kind: "photo" });
    expect(await questEvents(deps, "a1")).toHaveLength(1);
    expect((await deps.repos.attendees.get("a1"))?.xp).toBe(25 * 4 + 80);
  });

  it("GM-10 concurrent quest completion only awards quest XP once", async () => {
    const { deps } = setup();
    await seed(deps, "a1", "AAAAAA", [quest("q-photo1", 80, "photo", 1, null)]);
    await deps.repos.xpEvents.create({
      id: "photo-1",
      conference_id: "conf-demo",
      attendee_id: "a1",
      kind: "photo",
      talk_id: null,
      other_attendee_id: null,
      quest_id: null,
      party_id: null,
      base_xp: 25,
      multiplier: 1,
      xp: 25,
      at: "2026-11-09T19:00:00.000Z",
    });

    await Promise.all([checkQuests(deps, "a1"), checkQuests(deps, "a1")]);

    const events = await questEvents(deps, "a1");
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ id: "a1:quest:q-photo1", quest_id: "q-photo1", xp: 80 });
    expect((await deps.repos.attendees.get("a1"))?.xp).toBe(80);
  });

  it("GM-10 talk_ids restricts which check-ins count", async () => {
    const { deps, post } = setup();
    await seed(deps, "a1", "AAAAAA", [quest("q-two", 60, "checkin", 2, ["talk-1", "talk-2"])]);
    await post({ attendee_id: "a1", kind: "checkin", talk_id: "talk-3" });
    await post({ attendee_id: "a1", kind: "checkin", talk_id: "talk-4" });
    await post({ attendee_id: "a1", kind: "checkin", talk_id: "talk-1" });
    expect(await questEvents(deps, "a1")).toHaveLength(0);
    await post({ attendee_id: "a1", kind: "checkin", talk_id: "talk-2" });
    expect(await questEvents(deps, "a1")).toHaveLength(1);
  });

  it("GM-10 a boss quest counts only check-ins to talks on the attendee's map", async () => {
    const { deps, post } = setup();
    // fixtures.attendee's map is talk-1, talk-2, talk-4
    await seed(deps, "a1", "AAAAAA", [quest("q-bosses", 200, "boss", 2, null)]);
    await post({ attendee_id: "a1", kind: "checkin", talk_id: "talk-3" });
    await post({ attendee_id: "a1", kind: "checkin", talk_id: "talk-5" });
    await post({ attendee_id: "a1", kind: "checkin", talk_id: "talk-1" });
    expect(await questEvents(deps, "a1")).toHaveLength(0);
    await post({ attendee_id: "a1", kind: "checkin", talk_id: "talk-2" });
    expect(await questEvents(deps, "a1")).toHaveLength(1);
  });

  it("GM-10 the POST /xp response includes the quest XP", async () => {
    const { deps, post } = setup();
    await seed(deps, "a1", "AAAAAA", [quest("q-photo1", 75, "photo", 1, null)]);
    const r = XpResponse.parse((await post({ attendee_id: "a1", kind: "photo" })).json);
    expect(r.event.kind).toBe("photo");
    expect(r.attendee.xp).toBe(25 + 75);
    expect(r.attendee.level).toBe(2);
  });

  it("GM-10 goal quest: one check-in at a specific talk completes it", async () => {
    const { deps, post } = setup();
    await seed(deps, "a1", "AAAAAA", [quest("q-goal", 120, "checkin", 1, ["talk-2"], "goal")]);
    await post({ attendee_id: "a1", kind: "checkin", talk_id: "talk-3" });
    expect(await questEvents(deps, "a1")).toHaveLength(0);
    await post({ attendee_id: "a1", kind: "checkin", talk_id: "talk-2" });
    expect(await questEvents(deps, "a1")).toHaveLength(1);
  });

  it("GM-10 network quest counts the attendee's own network events", async () => {
    const { deps, post } = setup();
    await seed(deps, "a1", "AAAAAA", [quest("q-net", 40, "network", 1, null)]);
    await seed(deps, "b1", "BBBBBB", []);
    await post({ attendee_id: "a1", kind: "network", other_code: "BBBBBB" });
    expect(await questEvents(deps, "a1")).toHaveLength(1);
    expect(await questEvents(deps, "b1")).toHaveLength(0);
  });

  it("GM-10 coin quest completes from seeded gifts, once, restricted by talk_ids", async () => {
    const { deps } = setup();
    await seed(deps, "a1", "AAAAAA", [quest("q-coin", 90, "coin", 2, ["talk-1"])]);
    const gift = (id: string, talk_id: string) =>
      deps.repos.coins.create({
        id,
        conference_id: "conf-demo",
        from_attendee_id: "a1",
        speaker_id: "spk-ada",
        talk_id,
        note: "",
        at: "2026-11-09T19:00:00.000Z",
      });
    await gift("c1", "talk-1");
    await gift("c2", "talk-3");
    expect((await checkQuests(deps, "a1"))?.xp).toBe(0);
    await gift("c3", "talk-1");
    expect((await checkQuests(deps, "a1"))?.xp).toBe(90);
    await checkQuests(deps, "a1");
    expect(await questEvents(deps, "a1")).toHaveLength(1);
  });

  it("GM-10 several quests off one award each pay out once, and quest XP never counts toward targets", async () => {
    const { deps, post } = setup();
    await seed(deps, "a1", "AAAAAA", [quest("q1", 10, "photo", 1, null), quest("q2", 20, "photo", 1, null)]);
    const r = XpResponse.parse((await post({ attendee_id: "a1", kind: "photo" })).json);
    expect(r.attendee.xp).toBe(25 + 10 + 20);
    expect(await questEvents(deps, "a1")).toHaveLength(2);
  });

  it("GM-10 checking quests reads the attendee's events once, not once per quest (P.W2 latency)", async () => {
    const { deps } = setup();
    const quests = Array.from({ length: 8 }, (_, i) => quest(`q-${i}`, 10, "photo", 5, null));
    await seed(deps, "a1", "AAAAAA", quests);
    const find = vi.spyOn(deps.repos.xpEvents, "find");
    const count = vi.spyOn(deps.repos.xpEvents, "count");
    await checkQuests(deps, "a1");
    // No quest is met, so: one events read and no per-quest count.
    expect({ find: find.mock.calls.length, count: count.mock.calls.length }).toEqual({ find: 1, count: 0 });
  });
});

