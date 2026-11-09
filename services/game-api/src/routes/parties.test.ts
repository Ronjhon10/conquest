import { type Attendee, ErrorBody, fixtures, PartyResponse } from "@conquest/contracts";
import { describe, expect, it } from "vitest";
import { createApp } from "../app";
import { type Deps, memoryDeps } from "../deps";

function setup() {
  let n = 0;
  const deps = memoryDeps({ now: () => new Date("2026-11-09T19:00:00.000Z"), newId: () => `id-${++n}` });
  const app = createApp(deps);
  const post = async (path: string, payload: unknown) => {
    const res = await app.request(`/api/game${path}`, {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "content-type": "application/json" },
    });
    return { res, json: (await res.json()) as unknown };
  };
  return { deps, post };
}

async function seed(deps: Deps, id: string, over: Partial<Attendee> = {}) {
  return deps.repos.attendees.create({
    ...fixtures.attendee,
    id,
    code: `${id[0]?.toUpperCase()}22222`,
    xp: 0,
    level: 1,
    coins: 3,
    party_id: null,
    ...over,
  });
}
const errCode = (j: unknown) => ErrorBody.parse(j).error.code;

describe("parties", () => {
  it("GM-12 create makes a one-member party and sets the creator's party_id; second create is 409", async () => {
    const { deps, post } = setup();
    await seed(deps, "a1");
    const r = await post("/parties", { attendee_id: "a1", name: "Rogues" });
    expect(r.res.status).toBe(200);
    const { party } = PartyResponse.parse(r.json);
    expect(party).toMatchObject({ name: "Rogues", member_ids: ["a1"], conference_id: fixtures.attendee.conference_id });
    expect((await deps.repos.attendees.get("a1"))?.party_id).toBe(party.id);
    const again = await post("/parties", { attendee_id: "a1", name: "Two" });
    expect(again.res.status).toBe(409);
    expect(errCode(again.json)).toBe("already_in_party");
    const ghost = await post("/parties", { attendee_id: "ghost", name: "X" });
    expect(ghost.res.status).toBe(404);
  });

  it("GM-12 join adds a member; unknown party/attendee is 404; wrong conference is 400", async () => {
    const { deps, post } = setup();
    await seed(deps, "a1");
    await seed(deps, "b1");
    await seed(deps, "c1", { conference_id: "other-conf" });
    const { party } = PartyResponse.parse((await post("/parties", { attendee_id: "a1", name: "P" })).json);
    const j = await post(`/parties/${party.id}/join`, { attendee_id: "b1" });
    expect(j.res.status).toBe(200);
    expect(PartyResponse.parse(j.json).party.member_ids).toEqual(["a1", "b1"]);
    expect((await deps.repos.attendees.get("b1"))?.party_id).toBe(party.id);
    expect((await post("/parties/nope/join", { attendee_id: "b1" })).res.status).toBe(404);
    expect((await post(`/parties/${party.id}/join`, { attendee_id: "ghost" })).res.status).toBe(404);
    const wc = await post(`/parties/${party.id}/join`, { attendee_id: "c1" });
    expect(wc.res.status).toBe(400);
    expect(errCode(wc.json)).toBe("wrong_conference");
  });

  it("GM-12 max 4: the fifth join is 409 party_full", async () => {
    const { deps, post } = setup();
    for (const id of ["a1", "b1", "c1", "d1", "e1"]) await seed(deps, id);
    const { party } = PartyResponse.parse((await post("/parties", { attendee_id: "a1", name: "P" })).json);
    for (const id of ["b1", "c1", "d1"]) {
      expect((await post(`/parties/${party.id}/join`, { attendee_id: id })).res.status).toBe(200);
    }
    const full = await post(`/parties/${party.id}/join`, { attendee_id: "e1" });
    expect(full.res.status).toBe(409);
    expect(errCode(full.json)).toBe("party_full");
    expect((await deps.repos.attendees.get("e1"))?.party_id).toBeNull();
  });

  it("GM-12 an attendee can't be in two parties", async () => {
    const { deps, post } = setup();
    await seed(deps, "a1");
    await seed(deps, "b1");
    const p1 = PartyResponse.parse((await post("/parties", { attendee_id: "a1", name: "One" })).json).party;
    const p2 = PartyResponse.parse((await post("/parties", { attendee_id: "b1", name: "Two" })).json).party;
    for (const [pid, aid] of [
      [p2.id, "a1"],
      [p1.id, "a1"],
    ] as const) {
      const r = await post(`/parties/${pid}/join`, { attendee_id: aid });
      expect(r.res.status).toBe(409);
      expect(errCode(r.json)).toBe("already_in_party");
    }
  });

  it("GM-12 concurrent joins never exceed 4 members", async () => {
    const { deps, post } = setup();
    const ids = ["a1", "b1", "c1", "d1", "e1", "f1", "g1"];
    for (const id of ids) await seed(deps, id);
    const { party } = PartyResponse.parse((await post("/parties", { attendee_id: "a1", name: "P" })).json);
    const rs = await Promise.all(ids.slice(1).map((id) => post(`/parties/${party.id}/join`, { attendee_id: id })));
    const stored = await deps.repos.parties.get(party.id);
    expect(stored?.member_ids.length).toBeLessThanOrEqual(4);
    expect(rs.filter((r) => r.res.status === 200).length).toBe((stored?.member_ids.length ?? 0) - 1);
    expect(rs.every((r) => [200, 409].includes(r.res.status))).toBe(true);
  });
});
