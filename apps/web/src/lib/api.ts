import * as C from "@conquest/contracts";
import { createFakeTransport } from "./fake-api";

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 0,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export type Transport = (path: string, init?: RequestInit) => Promise<unknown>;
export function createHttpTransport(fetcher: typeof fetch = fetch): Transport {
  return async (path, init) => {
    let response: Response;
    try {
      response = await fetcher(path, {
        ...init,
        headers: { "Content-Type": "application/json", ...init?.headers },
      });
    } catch {
      throw new ApiError(
        "offline",
        "We couldn't reach Conquest. Check your connection and try again.",
      );
    }
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new ApiError(
        "invalid_response",
        "Conquest returned an unreadable response. Please try again.",
        response.status,
      );
    }
    if (!response.ok) {
      const error = C.ErrorBody.safeParse(body);
      throw new ApiError(
        error.success ? error.data.error.code : "request_failed",
        error.success
          ? error.data.error.message
          : "That action couldn't be completed. Please try again.",
        response.status,
      );
    }
    return body;
  };
}

// Both transports use exactly the same request and response schemas.
export function createApi(transport: Transport) {
  async function request<T>(
    path: string,
    schema: {
      safeParse: (
        value: unknown,
      ) => { success: true; data: T } | { success: false };
    },
    method = "GET",
    body?: unknown,
  ): Promise<T> {
    const result = await transport(path, {
      method,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const parsed = schema.safeParse(result);
    if (!parsed.success)
      throw new ApiError(
        "invalid_response",
        "Some conference data couldn't be loaded. Please try again.",
      );
    return parsed.data;
  }
  const id = encodeURIComponent;
  return {
    conference: (conf: string) =>
      request(`/api/game/conferences/${id(conf)}`, C.ConferenceResponse),
    createConference: (body: C.CreateConferenceRequest) =>
      request(
        "/api/game/conferences",
        C.ConferenceResponse,
        "POST",
        C.CreateConferenceRequest.parse(body),
      ),
    putQuests: (conf: string, body: C.PutQuestsRequest) =>
      request(
        `/api/game/conferences/${id(conf)}/quests`,
        C.ConferenceResponse,
        "PUT",
        C.PutQuestsRequest.parse(body),
      ),
    putRooms: (conf: string, body: C.PutRoomsRequest) =>
      request(
        `/api/game/conferences/${id(conf)}/rooms`,
        C.ConferenceResponse,
        "PUT",
        C.PutRoomsRequest.parse(body),
      ),
    draft: (body: C.DraftAttendeeRequest) =>
      request(
        "/api/game/attendees/draft",
        C.DraftAttendeeResponse,
        "POST",
        C.DraftAttendeeRequest.parse(body),
      ),
    createAttendee: (body: C.CreateAttendeeRequest) =>
      request(
        "/api/game/attendees",
        C.AttendeeResponse,
        "POST",
        C.CreateAttendeeRequest.parse(body),
      ),
    attendee: (attendee: string) =>
      request(`/api/game/attendees/${id(attendee)}`, C.GetAttendeeResponse),
    awardXp: (body: C.XpRequest) =>
      request("/api/game/xp", C.XpResponse, "POST", C.XpRequest.parse(body)),
    createParty: (body: C.CreatePartyRequest) =>
      request(
        "/api/game/parties",
        C.PartyResponse,
        "POST",
        C.CreatePartyRequest.parse(body),
      ),
    joinParty: (party: string, body: C.JoinPartyRequest) =>
      request(
        `/api/game/parties/${id(party)}/join`,
        C.PartyResponse,
        "POST",
        C.JoinPartyRequest.parse(body),
      ),
    giveCoin: (body: C.GiveCoinRequest) =>
      request(
        "/api/game/coins",
        C.GiveCoinResponse,
        "POST",
        C.GiveCoinRequest.parse(body),
      ),
    leaderboard: (conf: string) =>
      request(
        `/api/game/conferences/${id(conf)}/leaderboard`,
        C.LeaderboardResponse,
      ),
    report: (conf: string) =>
      request(`/api/game/conferences/${id(conf)}/report`, C.ReportResponse),
    recognition: (speaker: string) =>
      request(
        `/api/game/speakers/${id(speaker)}/recognition`,
        C.RecognitionResponse,
      ),
    recap: (attendee: string) =>
      request(
        `/api/game/attendees/${id(attendee)}/recap`,
        C.RecapResponse,
        "POST",
      ),
    talks: (q = "") =>
      request(
        `/api/search/talks?q=${encodeURIComponent(q)}&limit=100`,
        C.SearchTalksResponse,
      ),
    talk: (talk: string) =>
      request(`/api/search/talks/${id(talk)}`, C.GetTalkResponse),
    speaker: (speaker: string) =>
      request(`/api/search/speakers/${id(speaker)}`, C.GetSpeakerResponse),
    rank: (body: C.RankRequest) =>
      request(
        "/api/search/rank",
        C.RankResponse,
        "POST",
        C.RankRequest.parse(body),
      ),
    suggestGoals: (body: C.SuggestGoalsRequest) =>
      request(
        "/api/search/suggest-goals",
        C.SuggestGoalsResponse,
        "POST",
        C.SuggestGoalsRequest.parse(body),
      ),
  };
}
export type Api = ReturnType<typeof createApi>;
let instance: Api | undefined;
export function getApi(): Api {
  return (instance ??= createApi(
    process.env.NEXT_PUBLIC_FAKE_API === "1"
      ? createFakeTransport()
      : createHttpTransport(),
  ));
}
export function readableError(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : "Something went wrong. Please try again.";
}
