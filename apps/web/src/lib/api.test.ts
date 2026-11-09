import { describe, expect, it, vi } from "vitest";
import { fixtures } from "@conquest/contracts";
import { ApiError, createApi, createHttpTransport, readableError } from "./api";
import { createFakeTransport } from "./fake-api";

describe("Web API foundation", () => {
  it("WEB-1 supplies every read model used by the page shells without network access", async () => {
    const network = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("Network forbidden in fake mode"));
    try {
      const api = createApi(createFakeTransport());
      const [
        conference,
        talks,
        attendee,
        board,
        report,
        recap,
        speaker,
        recognition,
        talk,
        goals,
        rank,
      ] = await Promise.all([
        api.conference("conf-demo"),
        api.talks(),
        api.attendee("att-jane"),
        api.leaderboard("conf-demo"),
        api.report("conf-demo"),
        api.recap("att-jane"),
        api.speaker("spk-ada"),
        api.recognition("spk-ada"),
        api.talk("talk-1"),
        api.suggestGoals({ about: "SRE" }),
        api.rank({ goals: ["Platform"], about: "SRE" }),
      ]);
      expect(conference.conference.id).toBe("conf-demo");
      expect(talks.results).toHaveLength(12);
      expect(board.rows).toHaveLength(3);
      expect(attendee.attendee.name).toBeTruthy();
      expect(attendee.allies).toHaveLength(1);
      expect(report.report.attendees).toBe(3);
      expect(recap.recap.post_text).toContain("#Conquest");
      expect(speaker.speaker.id).toBe("spk-ada");
      expect(recognition.recognition.coins).toBe(0);
      expect(talk.talk.id).toBe("talk-1");
      expect(goals.goals.length).toBeGreaterThan(0);
      expect(rank.bosses.length).toBeGreaterThan(0);
      expect(network).not.toHaveBeenCalled();
    } finally {
      network.mockRestore();
    }
  });
  it("WEB-1 preserves created conference and attendee state within one fake session", async () => {
    const api = createApi(createFakeTransport());
    const { conference } = await api.createConference({
      name: "Ocean Con",
      theme_prompt: "Coral chambers",
    });
    const { attendee } = await api.createAttendee({
      conference_id: conference.id,
      name: "Danny",
      headline: "Web developer",
      about: "Accessible interfaces",
      linkedin_url: "https://www.linkedin.com/in/danny/",
      class: "bard",
      avatar_seed: "abcdefgh",
      goals: ["Accessibility"],
    });
    expect((await api.conference(conference.id)).conference.name).toBe(
      "Ocean Con",
    );
    expect((await api.attendee(attendee.id)).attendee.name).toBe("Danny");
    expect(
      (await api.leaderboard(conference.id)).rows.map((r) => r.name),
    ).toEqual(["Danny"]);
    const nextSession = createApi(createFakeTransport());
    await expect(nextSession.conference(conference.id)).rejects.toThrow();
  });
  it("WEB-1 returns isolated response objects so views cannot mutate fake state", async () => {
    const api = createApi(createFakeTransport());
    const response = await api.conference("conf-demo");
    response.conference.name = "Accidental mutation";
    expect((await api.conference("conf-demo")).conference.name).toBe(
      fixtures.conference.name,
    );
  });
  it("WEB-14 presents backend errors and a retryable message for network failures", async () => {
    const fail = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: "not_implemented",
            message: "Signup is being prepared. Please try again shortly.",
          },
        }),
        { status: 501 },
      ),
    );
    const api = createApi(createHttpTransport(fail));
    await expect(api.conference("conf-demo")).rejects.toMatchObject({
      code: "not_implemented",
      status: 501,
      message: "Signup is being prepared. Please try again shortly.",
    });
    const offline = createApi(
      createHttpTransport(
        vi.fn<typeof fetch>().mockRejectedValue(new Error("DNS")),
      ),
    );
    await expect(offline.conference("conf-demo")).rejects.toMatchObject({
      code: "offline",
    });
    expect(
      readableError(new Error("private implementation detail")),
    ).not.toContain("private implementation detail");
    expect(readableError(new ApiError("offline", "Try again"))).toBe(
      "Try again",
    );
  });
  it("WEB-14 rejects malformed success bodies and unreadable server responses", async () => {
    await expect(
      createApi(async () => ({ conference: {} })).conference("conf-demo"),
    ).rejects.toMatchObject({ code: "invalid_response" });
    const html = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response("<html>bad gateway</html>", { status: 502 }),
      );
    await expect(
      createApi(createHttpTransport(html)).conference("conf-demo"),
    ).rejects.toMatchObject({ code: "invalid_response", status: 502 });
  });
  it("WEB-14 uses relative API routes and safely encodes IDs", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify({ conference: fixtures.conference })),
      );
    await createApi(createHttpTransport(fetcher)).conference(
      "conf/other?name=x",
    );
    expect(fetcher.mock.calls[0]?.[0]).toBe(
      "/api/game/conferences/conf%2Fother%3Fname%3Dx",
    );
  });
});
