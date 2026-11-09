import { describe, expect, it } from "vitest";
import * as c from "./index";

describe("contracts", () => {
  it("GM-11 shared XP thresholds match the level formula", () => {
    expect([1, 2, 3, 4].map(c.xpForLevel)).toEqual([0, 100, 400, 900]);
  });

  it("OV-2 fixtures parse against their schemas", () => {
    for (const s of c.fixtures.speakers) c.Speaker.parse(s);
    for (const t of c.fixtures.talks) c.Talk.parse(t);
    c.Conference.parse(c.fixtures.conference);
    c.Attendee.parse(c.fixtures.attendee);
    for (const a of c.fixtures.allies) c.Ally.parse(a);
    for (const r of c.fixtures.leaderboard) c.LeaderboardRow.parse(r);
  });

  it("OV-2 exports every route body schema from 000", () => {
    const names = [
      "SearchTalksResponse", "GetTalkResponse", "RankRequest", "RankResponse", "SuggestGoalsRequest",
      "SuggestGoalsResponse", "GetSpeakerResponse", "CreateConferenceRequest", "ConferenceResponse", "ListConferencesResponse",
      "PutQuestsRequest", "PutRoomsRequest", "DraftAttendeeRequest", "DraftAttendeeResponse",
      "CreateAttendeeRequest", "AttendeeResponse", "GetAttendeeResponse", "XpRequest", "XpResponse",
      "CreatePartyRequest", "JoinPartyRequest", "PartyResponse", "GiveCoinRequest", "GiveCoinResponse",
      "LeaderboardResponse", "ReportResponse", "RecognitionResponse", "RecapResponse",
    ];
    for (const n of names) expect(c, n).toHaveProperty(n);
  });

  it("OV-4 errorBody has the shared error shape", () => {
    expect(c.ErrorBody.parse(c.errorBody("not_found", "No such talk"))).toEqual({
      error: { code: "not_found", message: "No such talk" },
    });
  });

  it("OV-2 normalized LinkedIn URLs and JPEG data URLs are enforced", () => {
    expect(c.LinkedInUrl.safeParse("https://www.linkedin.com/in/jane/").success).toBe(true);
    expect(c.LinkedInUrl.safeParse("linkedin.com/in/jane").success).toBe(false);
    expect(c.PhotoDataUrl.safeParse("data:image/png;base64,AAAA").success).toBe(false);
  });
});
