// Every store call is a network round trip to Elastic Serverless (~0.5 s per refreshed write, and
// reads add up too), behind a 15 s gateway timeout. Party members' check-ins were timing out on
// live (504s, with the XP saved anyway) because quest checks read the event history once per quest.
// These tests pin the number of store calls per check-in so that can't creep back.
import type { Attendee, Conference, Party, XpEvent } from "@conquest/contracts";
import { describe, expect, it } from "vitest";
import { createApp } from "../app";
import { memoryDeps } from "../deps";
import { createMemoryStore } from "../store/memory";
import { createRepos } from "../store/repos";
import type { DocStore } from "../store/store";

const READ_BUDGET = 20;
const WRITE_BUDGET = 6;

function setup() {
  const inner = createMemoryStore();
  const calls = { reads: 0, writes: 0 };
  const counted = (name: keyof DocStore, kind: "reads" | "writes") =>
    ((...args: never[]) => {
      calls[kind]++;
      return (inner[name] as (...a: never[]) => unknown)(...args);
    }) as never;
  const store: DocStore = {
    ...inner,
    get: counted("get", "reads"),
    find: counted("find", "reads"),
    count: counted("count", "reads"),
    create: counted("create", "writes"),
    put: counted("put", "writes"),
  };
  const app = createApp({ ...memoryDeps(), store, repos: createRepos(store) });
  type Body = { event?: XpEvent; conference?: Conference; attendee?: Attendee; party?: Party };
  const call = async (method: string, path: string, body?: unknown): Promise<Body> => {
    const res = await app.request(`/api/game${path}`, {
      method,
      headers: { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return (await res.json()) as Body;
  };
  const measure = async (body: unknown) => {
    calls.reads = calls.writes = 0;
    const res = await call("POST", "/xp", body);
    return { ...calls, res };
  };
  return { call, measure };
}

async function partyOfFour(t: ReturnType<typeof setup>) {
  const conf = (await t.call("POST", "/conferences", { name: "Golden", theme_prompt: "x" })).conference!;
  const signup = async (name: string): Promise<Attendee> =>
    (
      await t.call("POST", "/attendees", {
        conference_id: conf.id,
        name,
        headline: "SRE",
        about: "platform engineering observability",
        class: "knight",
        avatar_seed: "s1234567",
        goals: ["Observability", "Platform Engineering"],
      })
    ).attendee!;
  const members = [await signup("A"), await signup("B"), await signup("C"), await signup("D")];
  const solo = await signup("Solo");
  const party = (await t.call("POST", "/parties", { attendee_id: members[0]!.id, name: "The Golden Paths" })).party!;
  for (const m of members.slice(1)) await t.call("POST", `/parties/${party.id}/join`, { attendee_id: m.id });
  return { members, solo };
}

describe("store round trips per check-in", () => {
  it("GM-7 party members' check-ins (with the 1.25x bonus and quest completions) stay within the round-trip budget", async () => {
    const t = setup();
    const { members, solo } = await partyOfFour(t);
    for (const b of members[0]!.map.slice(0, 4)) {
      for (const who of [...members, solo]) {
        const { reads, writes, res } = await t.measure({ attendee_id: who.id, kind: "checkin", talk_id: b.talk_id });
        expect(res.event, JSON.stringify(res)).toBeDefined();
        expect(reads, `${who.name} reads on ${b.talk_id}`).toBeLessThanOrEqual(READ_BUDGET);
        expect(writes, `${who.name} writes on ${b.talk_id}`).toBeLessThanOrEqual(WRITE_BUDGET);
      }
    }
  });

  it("GM-7 the party bonus check costs one query no matter how big the party is", async () => {
    const t = setup();
    const { members, solo } = await partyOfFour(t);
    const talk = members[0]!.map[0]!.talk_id;
    await t.measure({ attendee_id: members[0]!.id, kind: "checkin", talk_id: talk });
    const member = await t.measure({ attendee_id: members[3]!.id, kind: "checkin", talk_id: talk });
    const alone = await t.measure({ attendee_id: solo.id, kind: "checkin", talk_id: talk });
    expect(member.res.event?.multiplier).toBe(1.25);
    // A party member does the party lookup (once for the bonus, once per award for telemetry)
    // and one check-in query; nothing per member.
    expect(member.reads - alone.reads).toBeLessThanOrEqual(4);
  });
});
