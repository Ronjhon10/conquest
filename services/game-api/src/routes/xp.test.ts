import { type Attendee, ErrorBody, fixtures, XpResponse } from "@conquest/contracts";
import { describe, expect, it } from "vitest";
import { createApp } from "../app";
import { type Deps, memoryDeps } from "../deps";
import { levelForXp } from "../xp/rules";

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

async function seed(deps: Deps, id: string, code: string, over: Partial<Attendee> = {}) {
  return deps.repos.attendees.create({ ...fixtures.attendee, id, code, xp: 0, level: 1, coins: 3, party_id: null, ...over });
}
const errCode = (j: unknown) => ErrorBody.parse(j).error.code;

describe("POST /xp", () => {
  it("GM-6 boss check-in gives 150 XP and +1 coin; non-boss gives 100; repeat is 409 already_checked_in", async () => {
    const { deps, post } = setup();
    await seed(deps, "a1", "AAAAAA");
    const boss = await post({ attendee_id: "a1", kind: "checkin", talk_id: "talk-1" });
    expect(boss.res.status).toBe(200);
    const b = XpResponse.parse(boss.json);
    expect(b.event).toMatchObject({ xp: 150, base_xp: 150, multiplier: 1, talk_id: "talk-1", kind: "checkin" });
    expect(b.attendee).toMatchObject({ xp: 150, level: 2, coins: 4 });
    const plain = XpResponse.parse((await post({ attendee_id: "a1", kind: "checkin", talk_id: "talk-3" })).json);
    expect(plain.event.xp).toBe(100);
    expect(plain.attendee).toMatchObject({ xp: 250, coins: 4 });
    const again = await post({ attendee_id: "a1", kind: "checkin", talk_id: "talk-1" });
    expect(again.res.status).toBe(409);
    expect(errCode(again.json)).toBe("already_checked_in");
  });

  it("GM-6 check-in needs talk_id, a real talk and a known attendee; quest kind is refused", async () => {
    const { deps, post } = setup();
    await seed(deps, "a1", "AAAAAA");
    expect(errCode((await post({ attendee_id: "a1", kind: "checkin" })).json)).toBe("bad_request");
    const nf = await post({ attendee_id: "a1", kind: "checkin", talk_id: "nope" });
    expect(nf.res.status).toBe(404);
    expect(errCode(nf.json)).toBe("talk_not_found");
    const un = await post({ attendee_id: "ghost", kind: "photo" });
    expect(un.res.status).toBe(404);
    expect(errCode(un.json)).toBe("not_found");
    const q = await post({ attendee_id: "a1", kind: "quest" });
    expect(q.res.status).toBe(400);
    expect(errCode(q.json)).toBe("quest_auto");
  });

  it("check-in multiplier is 1.0 and xp = base until the party bonus lands", async () => {
    const { deps, post } = setup();
    await seed(deps, "a1", "AAAAAA");
    const r = XpResponse.parse((await post({ attendee_id: "a1", kind: "checkin", talk_id: "talk-3" })).json);
    expect(r.event.multiplier).toBe(1);
    expect(r.event.xp).toBe(r.event.base_xp);
  });

  it("GM-8 photo gives 25 XP (talk optional) and the 21st is 409 photo_limit", async () => {
    const { deps, post } = setup();
    await seed(deps, "a1", "AAAAAA");
    const first = XpResponse.parse((await post({ attendee_id: "a1", kind: "photo", talk_id: "talk-2" })).json);
    expect(first.event).toMatchObject({ xp: 25, talk_id: "talk-2" });
    for (let i = 1; i < 20; i++) expect((await post({ attendee_id: "a1", kind: "photo" })).res.status).toBe(200);
    const over = await post({ attendee_id: "a1", kind: "photo" });
    expect(over.res.status).toBe(409);
    expect(errCode(over.json)).toBe("photo_limit");
    expect((await deps.repos.attendees.get("a1"))?.xp).toBe(500);
  });

  it("GM-9 network gives 50 XP to both, either-direction repeat is 409, own code is 400 self", async () => {
    const { deps, post } = setup();
    await seed(deps, "a1", "AAAAAA");
    await seed(deps, "b1", "BBBBBB");
    const r = await post({ attendee_id: "a1", kind: "network", other_code: "BBBBBB" });
    expect(r.res.status).toBe(200);
    const out = XpResponse.parse(r.json);
    expect(out.attendee.id).toBe("a1");
    expect(out.event).toMatchObject({ attendee_id: "a1", other_attendee_id: "b1", xp: 50 });
    expect((await deps.repos.attendees.get("a1"))?.xp).toBe(50);
    expect((await deps.repos.attendees.get("b1"))?.xp).toBe(50);
    expect(await deps.repos.xpEvents.count({ kind: "network" })).toBe(2);
    for (const p of [
      { attendee_id: "a1", kind: "network", other_code: "BBBBBB" },
      { attendee_id: "b1", kind: "network", other_code: "AAAAAA" },
    ]) {
      const dup = await post(p);
      expect(dup.res.status).toBe(409);
      expect(errCode(dup.json)).toBe("already_connected");
    }
    const self = await post({ attendee_id: "a1", kind: "network", other_code: "AAAAAA" });
    expect(self.res.status).toBe(400);
    expect(errCode(self.json)).toBe("self");
    expect((await post({ attendee_id: "a1", kind: "network", other_code: "ZZZZZZ" })).res.status).toBe(404);
    expect(errCode((await post({ attendee_id: "a1", kind: "network" })).json)).toBe("bad_request");
  });

  it("GM-11 level follows floor(sqrt(xp/100)) + 1", async () => {
    expect([0, 100, 400, 900].map(levelForXp)).toEqual([1, 2, 3, 4]);
    const { deps, post } = setup();
    await seed(deps, "a1", "AAAAAA", { xp: 75, level: 1 });
    const r = XpResponse.parse((await post({ attendee_id: "a1", kind: "photo" })).json);
    expect(r.attendee).toMatchObject({ xp: 100, level: 2 });
  });

  it("GM-17 two parallel awards to one attendee are both reflected in xp", async () => {
    const { deps, post } = setup();
    await seed(deps, "a1", "AAAAAA");
    const rs = await Promise.all([
      post({ attendee_id: "a1", kind: "photo" }),
      post({ attendee_id: "a1", kind: "checkin", talk_id: "talk-3" }),
    ]);
    expect(rs.map((r) => r.res.status)).toEqual([200, 200]);
    expect((await deps.repos.attendees.get("a1"))?.xp).toBe(125);
  });
});
