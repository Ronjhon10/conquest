import type { Attributes, Histogram, Span, SpanOptions, SpanStatus, Tracer } from "@opentelemetry/api";
import { describe, expect, it } from "vitest";
import { loadSchedule } from "./data";
import { rank } from "./rank";
import type { TalkStore } from "./store";
import type { Instruments } from "./telemetry";
import { MemoryTalkStore } from "./testing/memory-store";

type Recorded = { name: string; parent: string | null; attributes: Attributes; status: SpanStatus | null; ended: boolean };

/** Records spans and histogram points. Parent = the span whose callback is running when a span starts. */
function recorder() {
  const spans: Recorded[] = [];
  const points: { value: number; attributes: Attributes }[] = [];
  const stack: Recorded[] = [];
  const tracer = {
    startActiveSpan(name: string, opts: SpanOptions, fn: (span: Span) => unknown) {
      const rec: Recorded = { name, parent: stack.at(-1)?.name ?? null, attributes: { ...opts.attributes }, status: null, ended: false };
      spans.push(rec);
      const span = {
        setAttribute: (k: string, v: unknown) => ((rec.attributes[k] = v as never), span),
        setStatus: (s: SpanStatus) => ((rec.status = s), span),
        end: () => void (rec.ended = true),
      } as unknown as Span;
      stack.push(rec);
      try {
        return fn(span);
      } finally {
        stack.pop();
      }
    },
  } as unknown as Tracer;
  const rankDuration = { record: (value: number, attributes: Attributes = {}) => points.push({ value, attributes }) } as unknown as Histogram;
  return { inst: { tracer, rankDuration } satisfies Instruments, spans, points };
}

const store = new MemoryTalkStore(await loadSchedule());
const goals = ["ebpf observability", "platform engineering", "kubernetes security"];
const about = "Staff engineer at Acme Bank, previously Initech; I run hundreds of clusters.";

describe("rank telemetry (S.7, 020 Behavior 6)", () => {
  it("S.7 rank is one span with a child span per search, all ended", async () => {
    const r = recorder();
    const bosses = await rank(store, { goals, about }, r.inst);
    const root = r.spans.filter((s) => s.name === "search.rank");
    const children = r.spans.filter((s) => s.name === "search.rank.query");
    expect(root).toHaveLength(1);
    expect(children).toHaveLength(goals.length + 1);
    for (const c of children) expect(c.parent).toBe("search.rank");
    expect(children.map((c) => c.attributes["conquest.search.list"])).toEqual(["goal", "goal", "goal", "about"]);
    for (const c of children) expect(c.attributes["conquest.search.hits"]).toBeGreaterThan(0);
    expect(r.spans.every((s) => s.ended)).toBe(true);
    expect(root[0]!.attributes).toMatchObject({ "conquest.search.goals_count": 3, "conquest.search.has_about": true, "conquest.search.limit": 6, "conquest.search.bosses_count": bosses.length });
  });

  it("S.7 records conquest.search.rank.duration once per call, in ms, with an outcome", async () => {
    const r = recorder();
    await rank(store, { goals, about }, r.inst);
    await rank(store, { goals: [], about: "" }, r.inst);
    expect(r.points).toHaveLength(2);
    for (const p of r.points) {
      expect(p.value).toBeGreaterThanOrEqual(0);
      expect(p.attributes).toEqual({ outcome: "ok" });
    }
  });

  it("S.7 never puts goal text, about text or talk text in telemetry", async () => {
    const r = recorder();
    const bosses = await rank(store, { goals, about }, r.inst);
    const dump = JSON.stringify({ spans: r.spans, points: r.points }).toLowerCase();
    for (const text of [...goals, about, "acme", "initech", "ebpf", "platform", "security", "clusters"]) expect(dump).not.toContain(text.toLowerCase());
    for (const b of bosses) expect(dump).not.toContain(b.reason.toLowerCase());
  });

  it("S.7 a failed search marks both spans as errors by error class only, and records outcome error", async () => {
    const r = recorder();
    const failing = { searchTalks: async (q: string) => Promise.reject(new TypeError(`boom on ${q}`)) } as unknown as TalkStore;
    await expect(rank(failing, { goals: ["secret goal text"], about: "" }, r.inst)).rejects.toThrow(TypeError);
    for (const s of r.spans) {
      expect(s.status).toEqual({ code: 2, message: "TypeError" });
      expect(s.attributes["error.type"]).toBe("TypeError");
      expect(s.ended).toBe(true);
    }
    expect(r.points.map((p) => p.attributes)).toEqual([{ outcome: "error" }]);
    expect(JSON.stringify(r.spans)).not.toContain("secret goal text");
  });
});
