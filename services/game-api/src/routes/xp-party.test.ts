import { type Attendee, fixtures, XpResponse } from "@conquest/contracts";
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
type Post = ReturnType<typeof setup>["post"];

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

async function party(deps: Deps, post: Post, ids: string[]) {
  for (const id of ids) await seed(deps, id);
  const { json } = await post("/parties", { attendee_id: ids[0], name: "P" });
  const pid = (json as { party: { id: string } }).party.id;
  for (const id of ids.slice(1)) await post(`/parties/${pid}/join`, { attendee_id: id });
}
const checkin = async (post: Post, id: string, talk: string) =>
  XpResponse.parse((await post("/xp", { attendee_id: id, kind: "checkin", talk_id: talk })).json);

describe("party bonus", () => {
  it("GM-7 a member checking in after a party member gets 1.25x (188 boss, 125 non-boss); the first gets 1.0", async () => {
    const { deps, post } = setup();
    await party(deps, post, ["a1", "b1"]);
    const first = await checkin(post, "a1", "talk-1");
    expect(first.event).toMatchObject({ multiplier: 1, xp: 150 });
    const boss = await checkin(post, "b1", "talk-1");
    expect(boss.event).toMatchObject({ multiplier: 1.25, base_xp: 150, xp: 188 });
    await checkin(post, "a1", "talk-3");
    const plain = await checkin(post, "b1", "talk-3");
    expect(plain.event).toMatchObject({ multiplier: 1.25, xp: 125 });
    expect((await deps.repos.attendees.get("b1"))?.xp).toBe(313);
  });

  it("GM-7 the bonus is per talk: a talk no other member attended is 1.0", async () => {
    const { deps, post } = setup();
    await party(deps, post, ["a1", "b1"]);
    await checkin(post, "a1", "talk-1");
    expect((await checkin(post, "b1", "talk-3")).event.multiplier).toBe(1);
  });

  it("GM-7 attendees outside the party and without a party get 1.0", async () => {
    const { deps, post } = setup();
    await party(deps, post, ["a1", "b1"]);
    await seed(deps, "z1");
    await seed(deps, "y1");
    await checkin(post, "a1", "talk-1");
    expect((await checkin(post, "z1", "talk-1")).event.multiplier).toBe(1);
    await checkin(post, "z1", "talk-2");
    expect((await checkin(post, "y1", "talk-2")).event.multiplier).toBe(1);
  });
});
