import { Conference, ErrorBody, fixtures } from "@conquest/contracts";
import { describe, expect, it } from "vitest";
import { createApp } from "../app";
import { memoryDeps } from "../deps";
import { createFakeLlm } from "../llm";

const fixedNow = new Date("2026-05-01T10:00:00.000Z");
function setup(llmReply?: (purpose: string) => unknown) {
  let n = 0;
  const fake = llmReply ? createFakeLlm(llmReply) : null;
  const deps = memoryDeps({ llm: fake?.llm ?? null, now: () => fixedNow, newId: () => `id-${++n}` });
  const app = createApp(deps);
  const send = (method: string, path: string, json?: unknown) =>
    app.request(`/api/game${path}`, {
      method,
      body: json === undefined ? undefined : JSON.stringify(json),
      headers: { "content-type": "application/json" },
    });
  return { send, fake };
}

const goodTheme = {
  name: "Neon Nebula",
  prompt: "ignored",
  palette: { bg: "#0b1020", fg: "#ffffff", accent: "#00e5ff" },
  boss_noun: "titan",
  room_noun: "sector",
  intro: "Welcome to the Nebula.",
};
const FALLBACK_PALETTE = { bg: "#14111f", fg: "#f4efe6", accent: "#f2a541" };

async function create(send: ReturnType<typeof setup>["send"], extra: object = {}) {
  const res = await send("POST", "/conferences", { name: "KubeCon", theme_prompt: "space dungeon", ...extra });
  return { res, conference: Conference.parse(((await res.json()) as { conference: unknown }).conference) };
}

describe("conferences", () => {
  it("GM-1 without OpenAI the Kube Caverns fallback theme is used and the prompt is kept", async () => {
    const { send } = setup();
    const { res, conference } = await create(send);
    expect(res.status).toBe(200);
    expect(conference.theme).toMatchObject({
      name: "Kube Caverns",
      prompt: "space dungeon",
      palette: FALLBACK_PALETTE,
      boss_noun: "boss",
      room_noun: "chamber",
    });
    expect(conference.theme.intro.length).toBeGreaterThan(0);
  });

  it("GM-1 a failed or invalid OpenAI answer falls back", async () => {
    for (const reply of [null, { name: "x" }, "nonsense"]) {
      const { send } = setup(() => reply);
      const { conference } = await create(send);
      expect(conference.theme.name).toBe("Kube Caverns");
      expect(conference.theme.prompt).toBe("space dungeon");
    }
  });

  it("GM-1 a generated theme with fg-on-bg contrast under 4.5 is replaced by the fallback", async () => {
    const low = { ...goodTheme, palette: { bg: "#777777", fg: "#888888", accent: "#ff0000" } };
    const { send } = setup(() => low);
    const { conference } = await create(send);
    expect(conference.theme.palette).toEqual(FALLBACK_PALETTE);
    expect(conference.theme.prompt).toBe("space dungeon");
  });

  it("GM-1 a valid generated theme is used, with prompt set to the organizer's text", async () => {
    const { send, fake } = setup(() => goodTheme);
    const { conference } = await create(send);
    expect(conference.theme).toEqual({ ...goodTheme, prompt: "space dungeon" });
    expect(fake?.requests[0]?.purpose).toBe("theme");
    expect(fake?.requests[0]?.user).toBe("space dungeon");
  });

  it("GM-2 every new conference gets the three default organizer quests", async () => {
    const { send } = setup();
    const { conference } = await create(send);
    expect(conference.quests.map((q) => [q.title, q.target.type, q.target.count, q.xp, q.kind])).toEqual([
      ["Meet five adventurers", "network", 5, 150, "organizer"],
      ["Defeat three bosses", "checkin", 3, 200, "organizer"],
      ["Capture the moment", "photo", 3, 75, "organizer"],
    ]);
    expect(new Set(conference.quests.map((q) => q.id)).size).toBe(3);
    expect(conference.created_at).toBe(fixedNow.toISOString());
  });

  it("GM-2 PUT quests replaces the quests with fresh ids, including sponsor quests", async () => {
    const { send } = setup();
    const { conference } = await create(send);
    const quest = {
      title: "Visit the Acme booth",
      description: "Say hi",
      xp: 50,
      kind: "sponsor",
      sponsor: "Acme",
      target: { type: "photo", count: 1, talk_ids: null },
    };
    const res = await send("PUT", `/conferences/${conference.id}/quests`, { quests: [quest] });
    expect(res.status).toBe(200);
    const updated = Conference.parse(((await res.json()) as { conference: unknown }).conference);
    expect(updated.quests).toHaveLength(1);
    expect(updated.quests[0]).toMatchObject(quest);
    expect(conference.quests.map((q) => q.id)).not.toContain(updated.quests[0]?.id);
    const got = await send("GET", `/conferences/${conference.id}`);
    expect(((await got.json()) as { conference: Conference }).conference.quests).toEqual(updated.quests);
  });

  it("GM-3 rooms default to every distinct room in the talks index, all step-free", async () => {
    const { send } = setup();
    const { conference } = await create(send);
    const expected = [...new Set(fixtures.talks.map((t) => t.room))].sort();
    expect(expected.length).toBeGreaterThan(0);
    expect(conference.rooms.map((r) => r.name)).toEqual(expected);
    for (const room of conference.rooms) expect(room).toMatchObject({ step_free: true, step_free_note: null });
  });

  it("GM-3 rooms given in the body are used as-is", async () => {
    const { send } = setup();
    const rooms = [{ name: "Hall A", step_free: false, step_free_note: "Two stairs" }];
    const { conference } = await create(send, { rooms });
    expect(conference.rooms).toEqual(rooms);
  });

  it("GM-3 PUT rooms replaces the rooms so organizers can mark a room not step-free", async () => {
    const { send } = setup();
    const { conference } = await create(send);
    const rooms = [
      { name: "Hall A", step_free: true, step_free_note: null },
      { name: "Hall B", step_free: false, step_free_note: "Lift out of order" },
    ];
    const res = await send("PUT", `/conferences/${conference.id}/rooms`, { rooms });
    expect(((await res.json()) as { conference: Conference }).conference.rooms).toEqual(rooms);
    const got = await send("GET", `/conferences/${conference.id}`);
    expect(((await got.json()) as { conference: Conference }).conference.rooms).toEqual(rooms);
  });

  it("an unknown conference answers 404 not_found on GET and both PUTs", async () => {
    const { send } = setup();
    const calls: [string, string, unknown?][] = [
      ["GET", "/conferences/nope"],
      ["PUT", "/conferences/nope/quests", { quests: [] }],
      ["PUT", "/conferences/nope/rooms", { rooms: [] }],
    ];
    for (const [m, p, b] of calls) {
      const res = await send(m, p, b);
      expect(res.status).toBe(404);
      expect(ErrorBody.parse(await res.json()).error.code).toBe("not_found");
    }
  });

  it("a bad create body answers 400 bad_request", async () => {
    const { send } = setup();
    const res = await send("POST", "/conferences", { theme_prompt: "x" });
    expect(res.status).toBe(400);
    expect(ErrorBody.parse(await res.json()).error.code).toBe("bad_request");
  });
});
