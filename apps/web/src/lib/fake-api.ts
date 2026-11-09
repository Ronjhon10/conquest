import * as C from "@conquest/contracts";
import { normalizeLinkedIn } from "./signup";
import type { Transport } from "./api";

export type DemoStorage = Pick<Storage, "getItem" | "setItem">;
const SNAPSHOT_KEY = "conquest:demo-world:v2";

// Fixture simulation only; game rules belong to Game. Optional tab storage
// keeps signup available after refresh. No network or remote SDK is used.
export function createFakeTransport(storage?: DemoStorage): Transport {
  const conference = structuredClone(C.fixtures.conference);
  const talks = structuredClone(C.fixtures.talks);
  for (const [i, talk] of C.fixtures.talks.entries()) {
    talks.push({
      ...structuredClone(talk),
      id: `talk-${i + 7}`,
      title: `${talk.title}: Workshop`,
      starts_at: talk.starts_at.replace("2026-11-10", "2026-11-11"),
      ends_at: talk.ends_at.replace("2026-11-10", "2026-11-11"),
    });
  }
  const attendees: C.Attendee[] = [
    structuredClone(C.fixtures.attendee),
    ...["Sam Sample", "Alex Demo"].map((name, i) => ({
      ...structuredClone(C.fixtures.attendee),
      id: i === 0 ? "att-sam" : "att-alex",
      name,
      code: i === 0 ? "S7QX2M" : "A7QX2M",
      class: (i === 0 ? "bard" : "wizard") as C.CharacterClass,
      linkedin_url: `https://www.linkedin.com/in/${i === 0 ? "sam-sample" : "alex-demo"}/`,
    })),
  ];
  const conferences = [conference];
  const parties: C.Party[] = [];
  const gifts: C.CoinGift[] = [];
  let sequence = 0;
  try {
    const raw = storage?.getItem(SNAPSHOT_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      const confs = C.Conference.array().safeParse(saved.conferences);
      const users = C.Attendee.array().safeParse(saved.attendees);
      const teams = C.Party.array().safeParse(saved.parties);
      const coins = C.CoinGift.array().safeParse(saved.gifts);
      if (
        confs.success &&
        users.success &&
        teams.success &&
        coins.success &&
        Number.isSafeInteger(saved.sequence) &&
        saved.sequence >= 0
      ) {
        conferences.splice(0, conferences.length, ...confs.data);
        attendees.splice(0, attendees.length, ...users.data);
        parties.push(...teams.data);
        gifts.push(...coins.data);
        sequence = saved.sequence;
      }
    }
  } catch {
    /* Invalid or unavailable tab storage starts a fresh demo. */
  }
  const nextId = (prefix: string) => `${prefix}-demo-${++sequence}`;
  function find<T extends { id: string }>(items: T[], id: string): T {
    const item = items.find((item) => item.id === id);
    if (!item) throw new Error("That demo item could not be found.");
    return item;
  }
  return async (path, init) => {
    const url = new URL(path, "https://conquest.invalid");
    const parts = url.pathname
      .split("/")
      .filter(Boolean)
      .map(decodeURIComponent);
    const [, service, resource, id = "", action] = parts;
    const method = init?.method ?? "GET";
    const body: unknown = init?.body
      ? JSON.parse(String(init.body))
      : undefined;
    let result: unknown;
    if (service === "search") {
      if (resource === "talks" && !id) {
        const q = url.searchParams.get("q")?.toLowerCase() ?? "";
        result = {
          results: talks
            .filter((t) => `${t.title} ${t.abstract}`.toLowerCase().includes(q))
            .map((talk) => ({ talk, score: 1, highlight: talk.abstract })),
        };
      } else if (resource === "talks") {
        const talk = find(talks, id);
        result = {
          talk,
          speakers: C.fixtures.speakers.filter((s) =>
            talk.speaker_ids.includes(s.id),
          ),
        };
      } else if (resource === "speakers") {
        result = {
          speaker: find(C.fixtures.speakers, id),
          talks: talks.filter((t) => t.speaker_ids.includes(id)),
        };
      } else if (resource === "rank") {
        const input = C.RankRequest.parse(body);
        result = { bosses: C.fixtures.attendee.map.slice(0, input.limit ?? 6) };
      } else if (resource === "suggest-goals")
        result = {
          goals: ["Platform engineering", "Observability", "Security"],
        };
    } else if (resource === "conferences") {
      if (method === "POST") {
        const input = C.CreateConferenceRequest.parse(body);
        const created = {
          ...structuredClone(conference),
          id: nextId("conf"),
          name: input.name,
          theme: { ...conference.theme, prompt: input.theme_prompt },
          rooms: input.rooms ?? conference.rooms,
        };
        conferences.push(created);
        result = { conference: created };
      } else {
        const conf = find(conferences, id);
        if (method === "PUT" && action === "quests")
          conf.quests = C.PutQuestsRequest.parse(body).quests.map((q) => ({
            ...q,
            id: nextId("quest"),
          }));
        if (method === "PUT" && action === "rooms")
          conf.rooms = C.PutRoomsRequest.parse(body).rooms;
        if (action === "leaderboard")
          result = {
            rows: attendees
              .filter((a) => a.conference_id === id)
              .sort((a, b) => b.xp - a.xp)
              .slice(0, 10)
              .map((a) => ({
                attendee_id: a.id,
                name: a.name,
                class: a.class,
                xp: a.xp,
                level: a.level,
                photo: a.photo,
                avatar_seed: a.avatar_seed,
              })),
          };
        else if (action === "report")
          result = {
            report: {
              attendees: attendees.filter((a) => a.conference_id === id).length,
              checkins: 0,
              photos: 0,
              connections: 0,
              parties: parties.length,
              top_talks: [],
              quest_completion: [],
              xp_by_hour: [],
            },
          };
        else result = { conference: conf };
      }
    } else if (resource === "attendees") {
      if (id === "draft") {
        const input = C.DraftAttendeeRequest.parse(body);
        const text = `${input.headline} ${input.about}`.toLowerCase();
        const suggestedClass = /security|compliance/.test(text)
          ? "rogue"
          : /platform|infra|sre|ops/.test(text)
            ? "knight"
            : /data|\bml\b|\bai\b|research/.test(text)
              ? "wizard"
              : "bard";
        result = {
          class: suggestedClass,
          avatar_seed: "demo1234",
          suggested_goals: [
            "Platform engineering",
            "Observability",
            "Security",
          ],
        };
      } else if (method === "POST" && !id) {
        const input = C.CreateAttendeeRequest.parse(body);
        const conf = find(conferences, input.conference_id);
        const created = C.Attendee.parse({
          ...structuredClone(C.fixtures.attendee),
          ...input,
          id: nextId("att"),
          photo: input.photo ?? null,
          linkedin_url:
            normalizeLinkedIn(input.linkedin_url) ?? input.linkedin_url,
          map: [...talks.slice(0, 5), ...talks.slice(6, 7)].map((talk, i) => ({
            talk_id: talk.id,
            score: 1 / (i + 1),
            reason: input.goals.length
              ? `Matches your goal "${input.goals[i % input.goals.length]}"`
              : "Fits your background",
          })),
          xp: 0,
          level: 1,
          coins: 3,
          code: `D${sequence.toString(8).replace(/0/g, "A").replace(/1/g, "B").padStart(5, "2")}`,
          quests: conf.quests,
        });
        attendees.push(created);
        result = { attendee: created };
      } else {
        const attendee = find(attendees, id);
        if (action === "recap")
          result = {
            recap: {
              post_text:
                "An adventure in learning and connection at Demo Con. #KubeCon #Conquest",
              stats: {
                bosses: 0,
                allies: C.fixtures.allies.length,
                xp: attendee.xp,
                level: attendee.level,
                coins_given: gifts.filter((g) => g.from_attendee_id === id)
                  .length,
              },
            },
          };
        else
          result = {
            attendee,
            party: parties.find((p) => p.id === attendee.party_id) ?? null,
            allies: C.fixtures.allies,
          };
      }
    } else if (resource === "parties") {
      if (method === "POST" && !id) {
        const input = C.CreatePartyRequest.parse(body);
        const attendee = find(attendees, input.attendee_id);
        const party = {
          id: nextId("party"),
          conference_id: attendee.conference_id,
          name: input.name,
          member_ids: [attendee.id],
        };
        parties.push(party);
        attendee.party_id = party.id;
        result = { party };
      } else {
        const party = find(parties, id);
        const attendee = find(
          attendees,
          C.JoinPartyRequest.parse(body).attendee_id,
        );
        if (!party.member_ids.includes(attendee.id))
          party.member_ids.push(attendee.id);
        attendee.party_id = party.id;
        result = { party };
      }
    } else if (resource === "coins") {
      const input = C.GiveCoinRequest.parse(body);
      const attendee = find(attendees, input.from_attendee_id);
      const talk = find(talks, input.talk_id);
      const gift: C.CoinGift = {
        ...input,
        id: nextId("gift"),
        conference_id: attendee.conference_id,
        speaker_id: talk.speaker_ids[0] ?? "spk-ada",
        at: "2026-11-10T19:00:00Z",
      };
      gifts.push(gift);
      result = { gift, attendee };
    } else if (resource === "speakers") {
      result = {
        recognition: {
          speaker_id: id,
          coins: gifts.filter((g) => g.speaker_id === id).length,
          notes: gifts
            .filter((g) => g.speaker_id === id)
            .map((g) => ({
              from_name: find(attendees, g.from_attendee_id).name,
              note: g.note,
              talk_id: g.talk_id,
              at: g.at,
            })),
        },
      };
    }
    // XP simulation is deliberately deferred to W.4, against the Game lane's rules.
    if (result === undefined)
      throw new Error("This demo action isn't available yet.");
    if (method !== "GET") {
      try {
        storage?.setItem(
          SNAPSHOT_KEY,
          JSON.stringify({ conferences, attendees, parties, gifts, sequence }),
        );
      } catch {
        /* A full/blocked store keeps this session usable in memory. */
      }
    }
    return structuredClone(result);
  };
}
