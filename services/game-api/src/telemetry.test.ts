import { type Attendee, fixtures } from "@conquest/contracts";
import { metrics, trace } from "@opentelemetry/api";
import {
  AggregationTemporality,
  InMemoryMetricExporter,
  MeterProvider,
  PeriodicExportingMetricReader,
} from "@opentelemetry/sdk-metrics";
import { BasicTracerProvider, InMemorySpanExporter, SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "./app";
import { type Deps, memoryDeps } from "./deps";
import { resetInstruments } from "./telemetry";

const spans = new InMemorySpanExporter();
const metricExporter = new InMemoryMetricExporter(AggregationTemporality.CUMULATIVE);
const reader = new PeriodicExportingMetricReader({ exporter: metricExporter, exportIntervalMillis: 3_600_000 });
const meterProvider = new MeterProvider({ readers: [reader] });
const tracerProvider = new BasicTracerProvider({ spanProcessors: [new SimpleSpanProcessor(spans)] });

beforeAll(() => {
  trace.setGlobalTracerProvider(tracerProvider);
  metrics.setGlobalMeterProvider(meterProvider);
});
afterAll(async () => {
  trace.disable();
  metrics.disable();
  await meterProvider.shutdown();
  await tracerProvider.shutdown();
});
beforeEach(() => {
  spans.reset();
  resetInstruments();
});

function setup() {
  let n = 0;
  const deps = memoryDeps({ now: () => new Date("2026-11-09T19:00:00.000Z"), newId: () => `id-${++n}` });
  const app = createApp(deps);
  const post = (payload: unknown) =>
    app.request("/api/game/xp", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "content-type": "application/json" },
    });
  return { deps, post };
}

const seed = (deps: Deps, id: string, code: string, over: Partial<Attendee> = {}) =>
  deps.repos.attendees.create({ ...fixtures.attendee, id, code, xp: 0, level: 1, coins: 3, party_id: null, ...over });

/** Latest cumulative total of a counter, optionally for one `kind` attribute value. */
async function counter(name: string, kind?: string): Promise<number> {
  await reader.forceFlush();
  const all = metricExporter.getMetrics();
  const latest = all[all.length - 1];
  let total = 0;
  for (const sm of latest?.scopeMetrics ?? [])
    for (const m of sm.metrics)
      if (m.descriptor.name === name)
        for (const dp of m.dataPoints) if (kind === undefined || dp.attributes.kind === kind) total += dp.value as number;
  return total;
}

describe("xp telemetry", () => {
  it("GM-18 every XP award emits an xp.award span with four attributes and no personal text", async () => {
    const { deps, post } = setup();
    const a = await seed(deps, "a1", "AAAAAA", { party_id: "p1" });
    await seed(deps, "a2", "BBBBBB", { party_id: "p1" });
    await deps.repos.parties.create({ id: "p1", conference_id: a.conference_id, name: "Secret Party Name", member_ids: ["a1", "a2"] });
    await seed(deps, "a3", "CCCCCC");

    expect((await post({ attendee_id: "a1", kind: "checkin", talk_id: "talk-1" })).status).toBe(200);
    expect((await post({ attendee_id: "a3", kind: "photo" })).status).toBe(200);

    const done = spans.getFinishedSpans().filter((s) => s.name === "xp.award");
    expect(done).toHaveLength(2);
    expect(done[0]?.attributes).toEqual({
      "conquest.conference.id": a.conference_id,
      "conquest.xp.kind": "checkin",
      "conquest.xp.amount": 150,
      "conquest.party.size": 2,
    });
    expect(done[1]?.attributes).toMatchObject({ "conquest.xp.kind": "photo", "conquest.party.size": 0 });
    expect(Number(done[1]?.attributes["conquest.xp.amount"])).toBeGreaterThan(0);

    const personal = [a.name, a.headline, a.linkedin_url, "Secret Party Name"].filter(Boolean) as string[];
    for (const s of done)
      for (const v of Object.values(s.attributes)) for (const p of personal) expect(String(v)).not.toContain(p);
  });

  it("GM-18 check-in increments conquest.xp.awarded and conquest.checkins; photo only the xp counter", async () => {
    const { deps, post } = setup();
    await seed(deps, "a1", "AAAAAA");
    // Instruments are cumulative across tests, so assert on deltas.
    const base = {
      checkin: await counter("conquest.xp.awarded", "checkin"),
      photo: await counter("conquest.xp.awarded", "photo"),
      checkins: await counter("conquest.checkins"),
    };
    await post({ attendee_id: "a1", kind: "checkin", talk_id: "talk-1" });
    expect(await counter("conquest.xp.awarded", "checkin")).toBe(base.checkin + 150);
    expect(await counter("conquest.checkins")).toBe(base.checkins + 1);
    await post({ attendee_id: "a1", kind: "photo" });
    expect(await counter("conquest.checkins")).toBe(base.checkins + 1);
    expect(await counter("conquest.xp.awarded", "photo")).toBeGreaterThan(base.photo);
  });
});
