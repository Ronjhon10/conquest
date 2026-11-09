import { ConferenceResponse, INDEX, SearchRoomsResponse } from "@conquest/contracts";
import { describe, expect, it } from "vitest";
import { createApp } from "./app";
import { loadSchedule } from "./data";
import { EsTalkStore } from "./store";
import { MemoryEs } from "./testing/memory-es";
import { MemoryTalkStore } from "./testing/memory-store";
import { createApp as createGameApp } from "../../game-api/src/app";
import { memoryDeps } from "../../game-api/src/deps";
import { createHttpSearchClient } from "../../game-api/src/search/client";

const schedule = await loadSchedule();

it("GM-3 conference creation discovers all rooms through search-api, beyond the first 100 talks", async () => {
  const searchApp = createApp({ store: new MemoryTalkStore(schedule) });
  const deps = memoryDeps({ search: createHttpSearchClient("http://search", async (url, init) => searchApp.request(url, init)) });
  const response = await createGameApp(deps).request("/api/game/conferences", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "KubeCon", theme_prompt: "" }),
  });
  expect(response.status).toBe(200);
  const actual = ConferenceResponse.parse(await response.json()).conference.rooms;
  const allRooms = [...new Set(schedule.talks.map((t) => t.room))].sort();
  expect(new Set(schedule.talks.slice(0, 100).map((t) => t.room)).size).toBeLessThan(allRooms.length);
  expect(actual.map((r) => r.name)).toEqual(allRooms);
  for (const room of actual) expect(room).toMatchObject({ step_free: true, step_free_note: null });
});

describe("complete room enumeration", () => {
  it("OV-2 rooms endpoint returns the shared response contract", async () => {
    const response = await createApp({ store: new MemoryTalkStore(schedule) }).request("/api/search/rooms");
    expect(response.status).toBe(200);
    expect(SearchRoomsResponse.parse(await response.json()).rooms).toEqual([...new Set(schedule.talks.map((t) => t.room))].sort());
  });

  it("GM-3 Elasticsearch room enumeration follows every composite aggregation page", async () => {
    const es = new MemoryEs();
    const bodies: Record<string, unknown>[] = [];
    es.search = async <T,>(index: string, body: Record<string, unknown>) => {
      expect(index).toBe(INDEX.talks);
      bodies.push(body);
      const rooms = bodies.length === 1
        ? { buckets: [{ key: { room: "Hall A" } }, { key: { room: "Hall B" } }], after_key: { room: "Hall B" } }
        : { buckets: [{ key: { room: "Hall Z" } }] };
      return { hits: [] as { id: string; score: number; source: T; highlight: null }[], total: 0, aggregations: { rooms } };
    };
    expect(await new EsTalkStore(es).rooms()).toEqual(["Hall A", "Hall B", "Hall Z"]);
    expect(bodies[0]).toMatchObject({ size: 0, aggs: { rooms: { composite: { sources: [{ room: { terms: { field: "room" } } }] } } } });
    expect(bodies[1]).toMatchObject({ aggs: { rooms: { composite: { after: { room: "Hall B" } } } } });
  });

  it("GM-3 an empty talks index has no rooms", async () => {
    expect(await new MemoryTalkStore({ talks: [], speakers: [] }).rooms()).toEqual([]);
  });
});
