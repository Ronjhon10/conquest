import { type Attendee, ErrorBody, GiveCoinResponse, RecognitionResponse, fixtures } from "@conquest/contracts";
import { describe, expect, it } from "vitest";
import { createApp } from "../app";
import { memoryDeps } from "../deps";

function setup() {
  let n = 0;
  let clock = Date.parse("2026-11-09T19:00:00.000Z");
  const deps = memoryDeps({
    now: () => new Date((clock += 60_000)),
    newId: () => `id-${++n}`,
  });
  const app = createApp(deps);
  const addAttendee = (over: Partial<Attendee> = {}) =>
    deps.repos.attendees.create({ ...fixtures.attendee, ...over });
  const checkIn = (attendee_id: string, talk_id: string) =>
    deps.repos.xpEvents.create({
      id: `xp-${attendee_id}-${talk_id}`,
      conference_id: "conf-demo",
      attendee_id,
      kind: "checkin",
      talk_id,
      other_attendee_id: null,
      quest_id: null,
      party_id: null,
      base_xp: 50,
      multiplier: 1,
      xp: 50,
      at: "2026-11-09T19:00:00.000Z",
    });
  const give = (from_attendee_id: string, talk_id: string, note = "Great talk") =>
    app.request("/api/game/coins", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ from_attendee_id, talk_id, note }),
    });
  const recognition = async (speakerId: string) => {
    const res = await app.request(`/api/game/speakers/${speakerId}/recognition`);
    expect(res.status).toBe(200);
    return RecognitionResponse.parse(await res.json()).recognition;
  };
  return { deps, addAttendee, checkIn, give, recognition };
}

const code = async (res: Response) => ErrorBody.parse(await res.json()).error.code;

describe("coins and recognition", () => {
  it("GM-13 giving a coin needs a check-in to the talk (403)", async () => {
    const t = setup();
    await t.addAttendee();
    await t.checkIn("att-jane", "talk-1");
    const res = await t.give("att-jane", "talk-4");
    expect(res.status).toBe(403);
    expect(await code(res)).toBe("not_checked_in");
    expect((await t.deps.repos.attendees.get("att-jane"))?.coins).toBe(4);
  });

  it("GM-13 giving a coin needs a coin (409)", async () => {
    const t = setup();
    await t.addAttendee({ coins: 0 });
    await t.checkIn("att-jane", "talk-4");
    const res = await t.give("att-jane", "talk-4");
    expect(res.status).toBe(409);
    expect(await code(res)).toBe("no_coins");
    expect((await t.recognition("spk-lin")).coins).toBe(0);
  });

  it("GM-13 giving a coin lowers coins by 1", async () => {
    const t = setup();
    await t.addAttendee();
    await t.checkIn("att-jane", "talk-4");
    const res = await t.give("att-jane", "talk-4");
    expect(res.status).toBe(200);
    const out = GiveCoinResponse.parse(await res.json());
    expect(out.attendee.coins).toBe(3);
    expect(out.gift).toMatchObject({ speaker_id: "spk-lin", talk_id: "talk-4", from_attendee_id: "att-jane" });
    expect((await t.deps.repos.attendees.get("att-jane"))?.coins).toBe(3);
  });

  it("GM-13 the gift shows up in the speaker's recognition with the note", async () => {
    const t = setup();
    await t.addAttendee();
    await t.checkIn("att-jane", "talk-4");
    await t.give("att-jane", "talk-4", "Loved the tracing demo");
    const rec = await t.recognition("spk-lin");
    expect(rec.coins).toBe(1);
    expect(rec.notes).toHaveLength(1);
    expect(rec.notes[0]).toMatchObject({ from_name: "Jane Example", note: "Loved the tracing demo", talk_id: "talk-4" });
  });

  it("GM-13 the coin goes to the first speaker only", async () => {
    const t = setup();
    await t.addAttendee();
    await t.checkIn("att-jane", "talk-4");
    await t.give("att-jane", "talk-4");
    expect((await t.recognition("spk-lin")).coins).toBe(1);
    expect((await t.recognition("spk-ada")).coins).toBe(0);
  });

  it("GM-13 one gift per attendee per talk", async () => {
    const t = setup();
    await t.addAttendee();
    await t.checkIn("att-jane", "talk-4");
    expect((await t.give("att-jane", "talk-4")).status).toBe(200);
    const again = await t.give("att-jane", "talk-4");
    expect(again.status).toBe(409);
    expect(await code(again)).toBe("already_gifted");
    expect((await t.deps.repos.attendees.get("att-jane"))?.coins).toBe(3);
  });

  it("GM-13 recognition lists notes newest first", async () => {
    const t = setup();
    await t.addAttendee();
    await t.addAttendee({ id: "att-sam", name: "Sam Sample" });
    await t.checkIn("att-jane", "talk-4");
    await t.checkIn("att-sam", "talk-4");
    await t.give("att-jane", "talk-4", "first");
    await t.give("att-sam", "talk-4", "second");
    const rec = await t.recognition("spk-lin");
    expect(rec.coins).toBe(2);
    expect(rec.notes.map((x) => x.note)).toEqual(["second", "first"]);
    expect(rec.notes.map((x) => x.from_name)).toEqual(["Sam Sample", "Jane Example"]);
  });

  it("GM-13 a speaker with no gifts has an empty recognition", async () => {
    const t = setup();
    expect(await t.recognition("spk-omar")).toEqual({ speaker_id: "spk-omar", coins: 0, notes: [] });
  });

  it("GM-13 concurrent gifts never take coins below zero", async () => {
    const t = setup();
    await t.addAttendee({ coins: 1 });
    await t.checkIn("att-jane", "talk-4");
    await t.checkIn("att-jane", "talk-1");
    const [a, b] = await Promise.all([t.give("att-jane", "talk-4"), t.give("att-jane", "talk-1")]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    expect((await t.deps.repos.attendees.get("att-jane"))?.coins).toBe(0);
  });

  it("GM-13 unknown attendee is 404 not_found and unknown talk is 404 talk_not_found", async () => {
    const t = setup();
    const noAttendee = await t.give("nobody", "talk-4");
    expect(noAttendee.status).toBe(404);
    expect(await code(noAttendee)).toBe("not_found");
    await t.addAttendee();
    const noTalk = await t.give("att-jane", "talk-999");
    expect(noTalk.status).toBe(404);
    expect(await code(noTalk)).toBe("talk_not_found");
  });
});
