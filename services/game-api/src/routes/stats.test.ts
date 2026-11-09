import { ErrorBody, fixtures, LeaderboardResponse, ReportResponse, type Attendee, type XpEvent } from "@conquest/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app";
import { type Deps, memoryDeps } from "../deps";

const CONF = fixtures.conference.id;
const PHOTO = "data:image/jpeg;base64,/9j/4AAQ";

let deps: Deps;
let app: ReturnType<typeof createApp>;
let seq = 0;

const att = (id: string, over: Partial<Attendee> = {}): Attendee => ({
  ...fixtures.attendee,
  id,
  name: `Name ${id}`,
  ...over,
});

const ev = (attendee_id: string, kind: XpEvent["kind"], xp: number, at: string, over: Partial<XpEvent> = {}): XpEvent => ({
  id: `ev-${++seq}`,
  conference_id: CONF,
  attendee_id,
  kind,
  talk_id: null,
  other_attendee_id: null,
  quest_id: null,
  party_id: null,
  base_xp: xp,
  multiplier: 1,
  xp,
  at: `2026-11-09T${at}:00.000Z`,
  ...over,
});

async function seed(attendees: Attendee[], events: XpEvent[]) {
  for (const a of attendees) await deps.repos.attendees.create(a);
  for (const e of events) await deps.repos.xpEvents.create(e);
}

const getJson = async (path: string) => {
  const res = await app.request(`/api/game/conferences/${path}`);
  return { status: res.status, body: await res.json() };
};

beforeEach(async () => {
  seq = 0;
  deps = memoryDeps();
  app = createApp(deps);
  await deps.repos.conferences.create(fixtures.conference);
});

describe("leaderboard", () => {
  it("GM-14 orders by summed XP from events, descending", async () => {
    await seed(
      [att("a1"), att("a2"), att("a3")],
      [ev("a1", "checkin", 50, "10:00"), ev("a1", "photo", 20, "10:05"), ev("a2", "checkin", 100, "10:10"), ev("a3", "photo", 10, "10:15")],
    );
    const { status, body } = await getJson(`${CONF}/leaderboard`);
    expect(status).toBe(200);
    const rows = LeaderboardResponse.parse(body).rows;
    expect(rows.map((r) => [r.attendee_id, r.xp])).toEqual([["a2", 100], ["a1", 70], ["a3", 10]]);
  });

  it("GM-14 uses event totals, not the xp stored on the attendee", async () => {
    await seed([att("a1", { xp: 9999 })], [ev("a1", "checkin", 50, "10:00")]);
    const rows = LeaderboardResponse.parse((await getJson(`${CONF}/leaderboard`)).body).rows;
    expect(rows[0]?.xp).toBe(50);
  });

  it("GM-14 respects limit (default 10)", async () => {
    const ids = Array.from({ length: 12 }, (_, i) => `a${i + 1}`);
    await seed(ids.map((id) => att(id)), ids.map((id, i) => ev(id, "checkin", 10 + i, "10:00")));
    const top3 = LeaderboardResponse.parse((await getJson(`${CONF}/leaderboard?limit=3`)).body).rows;
    expect(top3.map((r) => r.attendee_id)).toEqual(["a12", "a11", "a10"]);
    expect(LeaderboardResponse.parse((await getJson(`${CONF}/leaderboard`)).body).rows).toHaveLength(10);
  });

  it("GM-14 breaks ties by earliest last event", async () => {
    await seed(
      [att("a1"), att("a2"), att("a3")],
      [
        ev("a1", "checkin", 50, "10:00"),
        ev("a1", "photo", 50, "12:00"), // a1: 100, last event 12:00
        ev("a2", "checkin", 100, "11:00"), // a2: 100, last event 11:00 -> ahead of a1
        ev("a3", "checkin", 100, "11:00"), // a3: same total and time as a2 -> id order
      ],
    );
    const rows = LeaderboardResponse.parse((await getJson(`${CONF}/leaderboard`)).body).rows;
    expect(rows.map((r) => r.attendee_id)).toEqual(["a2", "a3", "a1"]);
  });

  it("GM-14 only counts events of this conference", async () => {
    await seed([att("a1")], [ev("a1", "checkin", 50, "10:00"), ev("a1", "checkin", 500, "10:00", { conference_id: "other" })]);
    expect(LeaderboardResponse.parse((await getJson(`${CONF}/leaderboard`)).body).rows[0]?.xp).toBe(50);
  });

  it("GM-14 bad limit is 400, unknown conference is 404", async () => {
    expect((await getJson(`${CONF}/leaderboard?limit=0`)).status).toBe(400);
    const r = await getJson("nope/leaderboard");
    expect(r.status).toBe(404);
    expect(ErrorBody.parse(r.body).error.code).toBe("not_found");
  });

  it("GM-20 leaderboard rows carry the attendee's photo, name, class, level and avatar", async () => {
    await seed(
      [att("a1", { photo: PHOTO, class: "bard", level: 3, avatar_seed: "seed1" }), att("a2")],
      [ev("a1", "checkin", 50, "10:00"), ev("a2", "checkin", 10, "10:00")],
    );
    const rows = LeaderboardResponse.parse((await getJson(`${CONF}/leaderboard`)).body).rows;
    expect(rows[0]).toEqual({ attendee_id: "a1", name: "Name a1", class: "bard", xp: 50, level: 3, photo: PHOTO, avatar_seed: "seed1" });
    expect(rows[1]?.photo).toBeNull();
  });
});

describe("report", () => {
  const attendees = [att("a1"), att("a2"), att("a3")];
  const events = () => [
    ev("a1", "checkin", 50, "10:05", { talk_id: "talk-1" }),
    ev("a2", "checkin", 50, "10:10", { talk_id: "talk-1" }),
    ev("a3", "checkin", 50, "10:50", { talk_id: "talk-2" }),
    ev("a1", "checkin", 50, "11:05", { talk_id: "talk-2" }),
    ev("a1", "photo", 20, "11:10"),
    ev("a1", "network", 30, "11:20", { other_attendee_id: "a2" }),
    ev("a2", "network", 30, "11:20", { other_attendee_id: "a1" }),
    ev("a3", "network", 30, "11:30", { other_attendee_id: "a9" }),
    ev("a2", "quest", 100, "11:40", { quest_id: "q-meet5" }),
    ev("a3", "quest", 100, "11:45", { quest_id: "q-meet5" }),
    ev("a3", "quest", 100, "11:50", { quest_id: "q-boss3" }),
  ];

  it("GM-15 a fixture of known events gives the exact known report", async () => {
    await seed(attendees, events());
    await deps.repos.parties.create({ id: "p1", conference_id: CONF, name: "Party", member_ids: ["a1", "a2"] });
    await deps.repos.parties.create({ id: "p2", conference_id: "other", name: "Elsewhere", member_ids: [] });
    const { status, body } = await getJson(`${CONF}/report`);
    expect(status).toBe(200);
    expect(ReportResponse.parse(body).report).toEqual({
      attendees: 3,
      checkins: 4,
      photos: 1,
      connections: 1,
      parties: 1,
      top_talks: [
        { talk_id: "talk-1", checkins: 2 },
        { talk_id: "talk-2", checkins: 2 },
      ],
      quest_completion: [
        { quest_id: "q-meet5", completed: 2 },
        { quest_id: "q-boss3", completed: 1 },
      ],
      xp_by_hour: [
        { hour: "2026-11-09T10:00:00.000Z", xp: 150 },
        { hour: "2026-11-09T11:00:00.000Z", xp: 460 },
      ],
    });
  });

  it("GM-15 keeps only the top 5 talks and an empty conference reports zeros", async () => {
    const talks = Array.from({ length: 7 }, (_, i) => ev("a1", "checkin", 10, "10:00", { talk_id: `t${i}` }));
    await seed(attendees, talks);
    expect(ReportResponse.parse((await getJson(`${CONF}/report`)).body).report.top_talks).toHaveLength(5);

    await deps.repos.conferences.create({ ...fixtures.conference, id: "empty" });
    expect(ReportResponse.parse((await getJson("empty/report")).body).report).toEqual({
      attendees: 0,
      checkins: 0,
      photos: 0,
      connections: 0,
      parties: 0,
      top_talks: [],
      quest_completion: [],
      xp_by_hour: [],
    });
  });

  it("GM-15 unknown conference is 404 not_found", async () => {
    const r = await getJson("nope/report");
    expect(r.status).toBe(404);
    expect(ErrorBody.parse(r.body).error.code).toBe("not_found");
  });
});
