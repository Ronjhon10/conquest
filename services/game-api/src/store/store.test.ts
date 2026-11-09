import { fixtures, INDEX, type Attendee, type XpEvent } from "@conquest/contracts";
import { describe, expect, it, vi } from "vitest";
import { createElasticStore, toQuery, unsearchableFields } from "./elastic";
import { MAPPINGS } from "./indexes";
import { createMemoryStore } from "./memory";
import { createRepos, UPDATE_RETRIES } from "./repos";
import { AlreadyExistsError, type DocStore, VersionConflictError } from "./store";

const event = (over: Partial<XpEvent>): XpEvent => ({
  id: "ev-1",
  conference_id: "conf-demo",
  attendee_id: "att-jane",
  kind: "checkin",
  talk_id: "talk-1",
  other_attendee_id: null,
  quest_id: null,
  party_id: null,
  base_xp: 150,
  multiplier: 1,
  xp: 150,
  at: "2026-11-10T16:00:00.000Z",
  ...over,
});

/** The same behavior suite runs on every DocStore implementation. */
function storeSuite(name: string, make: () => Promise<DocStore>) {
  describe(`${name} repositories`, () => {
    it("ensureIndexes is idempotent", async () => {
      const store = await make();
      await store.ensureIndexes();
      await store.ensureIndexes();
      expect(await store.ping()).toBe(true);
    });

    it("create, get, and refuse a duplicate id", async () => {
      const repos = createRepos(await make());
      await repos.conferences.create(fixtures.conference);
      expect(await repos.conferences.get("conf-demo")).toEqual(fixtures.conference);
      expect(await repos.conferences.get("nope")).toBeNull();
      await expect(repos.conferences.create(fixtures.conference)).rejects.toBeInstanceOf(AlreadyExistsError);
    });

    it("rejects documents that don't match the contracts schema", async () => {
      const repos = createRepos(await make());
      const bad = { ...fixtures.attendee, code: "O0I1XX" } as Attendee;
      await expect(repos.attendees.create(bad)).rejects.toThrow();
    });

    it("put with a stale version is a VersionConflictError", async () => {
      const repos = createRepos(await make());
      await repos.attendees.create(fixtures.attendee);
      const read = (await repos.attendees.getVersioned("att-jane"))!;
      await repos.attendees.put({ ...read.doc, xp: 300 }, read.version);
      await expect(repos.attendees.put({ ...read.doc, xp: 400 }, read.version)).rejects.toBeInstanceOf(VersionConflictError);
      expect((await repos.attendees.get("att-jane"))!.xp).toBe(300);
    });

    it("update applies parallel changes without losing any", async () => {
      const repos = createRepos(await make());
      await repos.attendees.create({ ...fixtures.attendee, xp: 0 });
      await Promise.all([
        repos.attendees.update("att-jane", (a) => ({ ...a, xp: a.xp + 150 })),
        repos.attendees.update("att-jane", (a) => ({ ...a, xp: a.xp + 25 })),
      ]);
      expect((await repos.attendees.get("att-jane"))!.xp).toBe(175);
      expect(await repos.attendees.update("nope", (a) => a)).toBeNull();
    });

    it("find and count filter by exact values, array membership and null", async () => {
      const repos = createRepos(await make());
      await repos.xpEvents.create(event({ id: "e1", at: "2026-11-10T16:00:00.000Z" }));
      await repos.xpEvents.create(event({ id: "e2", kind: "photo", talk_id: null, at: "2026-11-10T17:00:00.000Z" }));
      await repos.xpEvents.create(event({ id: "e3", attendee_id: "att-sam", at: "2026-11-10T15:00:00.000Z" }));
      await repos.parties.create({ id: "p1", conference_id: "conf-demo", name: "Pod", member_ids: ["att-jane", "att-sam"] });

      expect(await repos.xpEvents.count({ attendee_id: "att-jane" })).toBe(2);
      expect((await repos.xpEvents.find({ attendee_id: "att-jane", kind: "checkin" })).map((e) => e.id)).toEqual(["e1"]);
      expect((await repos.xpEvents.find({ talk_id: null })).map((e) => e.id)).toEqual(["e2"]);
      const byTime = await repos.xpEvents.find({}, { sort: { field: "at", order: "asc" }, size: 2 });
      expect(byTime.map((e) => e.id)).toEqual(["e3", "e1"]);
      expect((await repos.parties.find({ member_ids: "att-sam" })).map((p) => p.id)).toEqual(["p1"]);
    });
  });
}

storeSuite("in-memory", async () => {
  const s = createMemoryStore();
  await s.ensureIndexes();
  return s;
});

// OV-6: Elasticsearch tests only run against a local container, when asked.
const esUrl = process.env.ES_INTEGRATION === "1" ? (process.env.ELASTICSEARCH_URL ?? "http://localhost:9200") : null;
if (esUrl) {
  const { Client } = await import("@elastic/elasticsearch");
  storeSuite("Elasticsearch", async () => {
    const es = new Client({ node: esUrl });
    for (const index of Object.keys(MAPPINGS)) await es.indices.delete({ index, ignore_unavailable: true });
    const s = createElasticStore(es);
    await s.ensureIndexes();
    return s;
  });
}

describe("index setup", () => {
  it("has a strict mapping for each of the five Game indexes", () => {
    expect(Object.keys(MAPPINGS).sort()).toEqual(
      [INDEX.conferences, INDEX.attendees, INDEX.xpEvents, INDEX.parties, INDEX.coins].sort(),
    );
    for (const m of Object.values(MAPPINGS)) expect(m.dynamic).toBe("strict");
  });

  it("030 Behavior 5: the attendee photo is stored but not indexed", () => {
    const photo = MAPPINGS[INDEX.attendees].properties!.photo as { index?: boolean };
    expect(photo.index).toBe(false);
  });

  it("the memory store creates every Game index", async () => {
    const s = createMemoryStore();
    await s.ensureIndexes();
    expect([...s.indexes].sort()).toEqual(Object.keys(MAPPINGS).sort());
  });

  it("filters become term / must_not exists queries", () => {
    expect(toQuery({})).toEqual({ match_all: {} });
    expect(toQuery({ attendee_id: "a", talk_id: null })).toEqual({
      bool: { filter: [{ term: { attendee_id: "a" } }], must_not: [{ exists: { field: "talk_id" } }] },
    });
  });

  it(`update gives up after ${UPDATE_RETRIES} retries on constant conflicts`, async () => {
    const inner = createMemoryStore();
    let puts = 0;
    const flaky: DocStore = {
      ...inner,
      put: async (index, id) => {
        puts++;
        throw new VersionConflictError(index, id);
      },
    };
    const repos = createRepos(flaky);
    await repos.attendees.create(fixtures.attendee);
    await expect(repos.attendees.update("att-jane", (a) => a)).rejects.toBeInstanceOf(VersionConflictError);
    expect(puts).toBe(UPDATE_RETRIES + 1);
  });
});

it("GM-17 upgrades existing attendee indexes with the durable outbox mapping", async () => {
  const putMapping = vi.fn().mockResolvedValue({ acknowledged: true });
  const getMapping = vi.fn(async ({ index }: { index: string }) => ({ [index]: { mappings: MAPPINGS[index as keyof typeof MAPPINGS] } }));
  const client = { indices: { exists: vi.fn().mockResolvedValue(true), putMapping, getMapping } };
  const store = createElasticStore(client as unknown as import("@elastic/elasticsearch").Client);
  await store.ensureIndexes();
  await store.ensureIndexes();
  expect(putMapping).toHaveBeenCalledTimes(2);
  expect(putMapping).toHaveBeenCalledWith({ index: INDEX.attendees, properties: {
    _xp_journal: { type: "object", enabled: false }, _xp_pending: { type: "boolean" },
  } });
});

describe("GM-23 stale index mappings", () => {
  const staleAttendees = {
    ...MAPPINGS[INDEX.attendees],
    properties: { ...MAPPINGS[INDEX.attendees].properties, linkedin_url: { type: "keyword", index: false, doc_values: false } },
  } as const;
  const fakeClient = (docs: number) => {
    const indices = {
      exists: vi.fn().mockResolvedValue(true),
      getMapping: vi.fn(async ({ index }: { index: string }) => ({
        [index]: { mappings: index === INDEX.attendees ? staleAttendees : MAPPINGS[index as keyof typeof MAPPINGS] },
      })),
      putMapping: vi.fn().mockResolvedValue({ acknowledged: true }),
      delete: vi.fn().mockResolvedValue({ acknowledged: true }),
      create: vi.fn().mockResolvedValue({ acknowledged: true }),
    };
    return { indices, count: vi.fn().mockResolvedValue({ count: docs }) };
  };
  const quiet = () => vi.spyOn(console, "log").mockImplementation(() => {});

  it("GM-23 finds linkedin_url unsearchable in an attendees index made by an older build", () => {
    expect(unsearchableFields(MAPPINGS[INDEX.attendees], staleAttendees)).toEqual(["linkedin_url"]);
    expect(unsearchableFields(MAPPINGS[INDEX.attendees], MAPPINGS[INDEX.attendees])).toEqual([]);
    expect(unsearchableFields(MAPPINGS[INDEX.attendees], undefined)).toEqual([]);
  });

  it("GM-23 recreates an empty stale attendees index so a LinkedIn link can be looked up", async () => {
    const log = quiet();
    const client = fakeClient(0);
    await createElasticStore(client as unknown as import("@elastic/elasticsearch").Client).ensureIndexes();
    expect(client.indices.delete).toHaveBeenCalledTimes(1);
    expect(client.indices.delete).toHaveBeenCalledWith({ index: INDEX.attendees }, { ignore: [404] });
    expect(client.indices.create).toHaveBeenCalledWith({ index: INDEX.attendees, mappings: MAPPINGS[INDEX.attendees] });
    log.mockRestore();
  });

  it("GM-23 rebuilds a stale attendees index that holds documents without losing any", async () => {
    const log = quiet();
    const client = { ...fakeClient(5), reindex: vi.fn().mockResolvedValue({ total: 5 }) };
    await createElasticStore(client as unknown as import("@elastic/elasticsearch").Client).ensureIndexes();
    const temp = `${INDEX.attendees}-migrate`;
    expect(client.reindex.mock.calls.map(([r]) => [r.source.index, r.dest.index])).toEqual([
      [INDEX.attendees, temp],
      [temp, INDEX.attendees],
    ]);
    expect(client.indices.create).toHaveBeenCalledWith({ index: temp, mappings: MAPPINGS[INDEX.attendees] });
    expect(client.indices.create).toHaveBeenCalledWith({ index: INDEX.attendees, mappings: MAPPINGS[INDEX.attendees] });
    expect(client.indices.delete).toHaveBeenLastCalledWith({ index: temp });
    log.mockRestore();
  });

  it("GM-23 leaves the original index alone when the copy comes up short", async () => {
    const log = quiet();
    const base = fakeClient(5);
    const count = vi.fn(async ({ index }: { index: string }) => ({ count: index.endsWith("-migrate") ? 4 : 5 }));
    const client = { ...base, count, reindex: vi.fn().mockResolvedValue({ total: 4 }) };
    await expect(createElasticStore(client as unknown as import("@elastic/elasticsearch").Client).ensureIndexes()).rejects.toThrow(/copied 4 of 5/);
    expect(base.indices.delete).not.toHaveBeenCalledWith({ index: INDEX.attendees });
    log.mockRestore();
  });
});
