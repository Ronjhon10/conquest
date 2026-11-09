import { ErrorBody, RecapResponse, fixtures, type XpEvent } from "@conquest/contracts";
import { describe, expect, it } from "vitest";
import { createApp } from "../app";
import { memoryDeps } from "../deps";
import { createFakeLlm } from "../llm";

const TAGS = "#KubeCon #Conquest";
let n = 0;
const ev = (o: Partial<XpEvent>): XpEvent => ({
  id: `ev-${++n}`, conference_id: "conf-demo", attendee_id: "att-jane", kind: "checkin", talk_id: null,
  other_attendee_id: null, quest_id: null, party_id: null, base_xp: 50, multiplier: 1, xp: 50, at: "2026-11-09T19:00:00.000Z", ...o,
});

async function setup(opts: { reply?: (p: string) => unknown; mapTalks?: string[]; checkins?: string[]; allies?: string[] } = {}) {
  const fake = opts.reply ? createFakeLlm(opts.reply) : null;
  const deps = memoryDeps({ llm: fake?.llm ?? null });
  const map = (opts.mapTalks ?? ["talk-1", "talk-2", "talk-4"]).map((talk_id) => ({ talk_id, score: 0.03, reason: "r" }));
  await deps.repos.attendees.create({ ...fixtures.attendee, map });
  for (const t of opts.checkins ?? ["talk-1", "talk-2"]) await deps.repos.xpEvents.create(ev({ talk_id: t }));
  for (const a of opts.allies ?? []) await deps.repos.xpEvents.create(ev({ kind: "network", other_attendee_id: a, xp: 25 }));
  const post = async (id = "att-jane") => createApp(deps).request(`/api/game/attendees/${id}/recap`, { method: "POST" });
  return { deps, post, requests: fake?.requests ?? [] };
}

describe("recap", () => {
  it("unknown attendee is 404 not_found", async () => {
    const { post } = await setup();
    const res = await post("nobody");
    expect(res.status).toBe(404);
    expect(ErrorBody.parse(await res.json()).error.code).toBe("not_found");
  });

  it("GM-16 without OpenAI uses the template with correct stats", async () => {
    const { deps, post } = await setup({ allies: ["att-sam", "att-sam", "att-bo"], checkins: ["talk-1", "talk-1", "talk-2", "talk-3"] });
    await deps.repos.coins.create({ id: "c1", conference_id: "conf-demo", from_attendee_id: "att-jane", speaker_id: "spk-ada", talk_id: "talk-1", note: "x", at: "2026-11-09T19:00:00.000Z" });
    const res = await post();
    expect(res.status).toBe(200);
    const { recap } = RecapResponse.parse(await res.json());
    // talk-3 is not on the map, talk-1 is checked in twice: 2 distinct bosses.
    expect(recap.stats).toEqual({ bosses: 2, allies: 2, xp: 250, level: 2, coins_given: 1 });
    expect(recap.post_text).toContain("Platform Engineering Without Tears");
    expect(recap.post_text).toContain("eBPF for Mere Mortals");
    expect(recap.post_text).not.toContain("Locking Down");
    expect(recap.post_text.length).toBeLessThan(1000);
    expect(recap.post_text.endsWith(TAGS)).toBe(true);
  });

  it("GM-16 template names at most three boss titles", async () => {
    const { post } = await setup({
      mapTalks: ["talk-1", "talk-2", "talk-3", "talk-4", "talk-5"],
      checkins: ["talk-1", "talk-2", "talk-3", "talk-4", "talk-5"],
    });
    const { recap } = RecapResponse.parse(await (await post()).json());
    expect(recap.stats.bosses).toBe(5);
    const titles = fixtures.talks.filter((t) => recap.post_text.includes(t.title));
    expect(titles).toHaveLength(3);
    expect(recap.post_text.endsWith(TAGS)).toBe(true);
  });

  it("GM-16 template handles zero bosses", async () => {
    const { post } = await setup({ checkins: [] });
    const { recap } = RecapResponse.parse(await (await post()).json());
    expect(recap.stats.bosses).toBe(0);
    expect(recap.post_text).toContain("first boss");
    expect(recap.post_text.endsWith(TAGS)).toBe(true);
  });

  it("GM-16 a valid LLM post is used", async () => {
    const text = `I had a great KubeCon and reached level 2! ${TAGS}`;
    const { post, requests } = await setup({ reply: () => `  ${text}\n` });
    const { recap } = RecapResponse.parse(await (await post()).json());
    expect(recap.post_text).toBe(text);
    expect(requests).toHaveLength(1);
    expect(requests[0]?.purpose).toBe("recap");
  });

  it("GM-16 an invalid LLM post falls back to the template", async () => {
    for (const bad of ["no hashtags here", `${"x".repeat(1000)} ${TAGS}`, "", "   "]) {
      const { post } = await setup({ reply: () => bad });
      const { recap } = RecapResponse.parse(await (await post()).json());
      expect(recap.post_text).toContain("I just finished KubeCon");
      expect(recap.post_text.endsWith(TAGS)).toBe(true);
    }
  });

  it("GM-16 the prompt has no coin note or about text", async () => {
    const { deps, post, requests } = await setup({ reply: () => `ok ${TAGS}` });
    await deps.repos.coins.create({ id: "c1", conference_id: "conf-demo", from_attendee_id: "att-jane", speaker_id: "spk-ada", talk_id: "talk-1", note: "SECRET-NOTE-TEXT", at: "2026-11-09T19:00:00.000Z" });
    await post();
    const prompt = requests.map((r) => `${r.system}\n${r.user}`).join("\n");
    expect(prompt).not.toContain("SECRET-NOTE-TEXT");
    expect(prompt).not.toContain(fixtures.attendee.headline);
    expect(prompt).toContain("Platform Engineering Without Tears");
    expect(prompt).toContain("knight");
  });
});
