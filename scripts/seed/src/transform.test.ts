import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { extractScheduleJson, htmlToText, parseNdjson, toNdjson, toUtc, transform, type SzAll } from "./transform";

const DATA = fileURLToPath(new URL("../../../data/kubecon-na-2026.ndjson", import.meta.url));

// A tiny hand-made Sessionize "all" export: one real-shaped talk, a break, a session with no
// speaker, and two speakers who share a name.
const sample: SzAll = {
  rooms: [{ id: 1, name: "Salt Palace | Level 1 | Hall DE" }],
  categories: [
    { id: 10, title: "All Sessions", items: [{ id: 11, name: "Security" }, { id: 12, name: "Breaks" }, { id: 13, name: "⚡ Lightning Talks" }] },
    { id: 20, title: "Audience Level", items: [{ id: 21, name: "Beginner" }] },
    { id: 30, title: "SubTopic", items: [{ id: 31, name: "Security" }, { id: 32, name: "Separate Registration Required" }] },
    { id: 40, title: "CNCF Projects", items: [{ id: 41, name: "Falco" }] },
  ],
  questions: [{ id: 100, question: "Company" }],
  speakers: [
    { id: "a", firstName: "Sam", lastName: "Lee", fullName: "Sam Lee", bio: "<p>Runs &amp; secures clusters.</p>", tagLine: null, profilePicture: "https://x/p.jpg", questionAnswers: [{ questionId: 100, answerValue: "Acme" }] },
    { id: "b", firstName: "Sam", lastName: "Lee", fullName: "Sam Lee", bio: "", tagLine: "Engineer, Other", profilePicture: null, questionAnswers: [] },
    { id: "c", firstName: "No", lastName: "Talks", fullName: "No Talks", bio: "", tagLine: null, profilePicture: null, questionAnswers: [] },
  ],
  sessions: [
    { id: "900", title: "Runtime Security with Falco", description: "<p>Catch attacks&#039; early.</p><p>Second<br>line</p>", startsAt: "2026-11-10T11:00:00", endsAt: "2026-11-10T11:30:00", isServiceSession: false, speakers: ["a", "b"], categoryItems: [11, 13, 21, 31, 32, 41], roomId: 1, status: "Accepted" },
    { id: "901", title: "Coffee Break", description: "Coffee.", startsAt: "2026-11-10T10:00:00", endsAt: "2026-11-10T10:30:00", isServiceSession: false, speakers: ["c"], categoryItems: [12], roomId: 1, status: "Accepted" },
    { id: "902", title: "Registration", description: "Get your badge.", startsAt: "2026-11-10T08:00:00", endsAt: "2026-11-10T17:00:00", isServiceSession: false, speakers: [], categoryItems: [], roomId: 1, status: "Accepted" },
    { id: "903", title: "No abstract", description: "", startsAt: "2026-11-10T12:00:00", endsAt: "2026-11-10T12:30:00", isServiceSession: false, speakers: ["a"], categoryItems: [11], roomId: 1, status: "Accepted" },
  ],
};

describe("seed transform (020 Behavior 1)", () => {
  it("SR-1 keeps sessions with a speaker and an abstract, drops breaks and registration", () => {
    const { talks } = transform(sample);
    expect(talks.map((t) => t.id)).toEqual(["talk-900"]);
  });

  it("SR-1 maps track, level, tags, room and UTC times", () => {
    const [t] = transform(sample).talks;
    expect(t).toMatchObject({
      title: "Runtime Security with Falco",
      abstract: "Catch attacks' early.\nSecond\nline",
      room: "Salt Palace | Level 1 | Hall DE",
      starts_at: "2026-11-10T18:00:00.000Z",
      ends_at: "2026-11-10T18:30:00.000Z",
      track: "Security",
      level: "Beginner",
    });
    expect(t!.tags.sort()).toEqual(["falco", "lightning talks", "security"]);
  });

  it("SR-1 speakers get unique spk-<slug> ids and only referenced speakers are kept", () => {
    const { talks, speakers } = transform(sample);
    expect(speakers.map((s) => s.id)).toEqual(["spk-sam-lee", "spk-sam-lee-2"]);
    expect(talks[0]!.speaker_ids).toEqual(["spk-sam-lee", "spk-sam-lee-2"]);
    expect(speakers[0]).toMatchObject({ company: "Acme", bio: "Runs & secures clusters.", photo_url: "https://x/p.jpg" });
    expect(speakers[1]).toMatchObject({ company: null, bio: "Engineer, Other", photo_url: null });
  });

  it("SR-1 NDJSON round-trips", () => {
    const data = transform(sample);
    expect(parseNdjson(toNdjson(data))).toEqual(data);
  });

  it("SR-1 extracts the embedded schedule block from the page HTML", () => {
    const html = `<html><script type="application/json" class="sched-data">${JSON.stringify({ all: sample })}</script></html>`;
    expect(extractScheduleJson(html).sessions).toHaveLength(4);
    expect(() => extractScheduleJson("<html></html>")).toThrow();
  });

  it("SR-1 helpers: html to text and venue time to UTC", () => {
    expect(htmlToText("<ul><li>a</li><li>b &quot;c&quot;</li></ul>")).toBe('- a\n- b "c"');
    expect(toUtc("2026-11-12T15:30:00")).toBe("2026-11-12T22:30:00.000Z");
  });
});

describe("committed seed data", () => {
  const { talks, speakers } = parseNdjson(readFileSync(DATA, "utf8"));

  it("SR-1 data/kubecon-na-2026.ndjson holds at least 40 valid talks, each with a speaker in the speakers data", () => {
    expect(talks.length).toBeGreaterThanOrEqual(40);
    const ids = new Set(speakers.map((s) => s.id));
    expect(ids.size).toBe(speakers.length);
    expect(new Set(talks.map((t) => t.id)).size).toBe(talks.length);
    for (const t of talks) {
      expect(t.id).toMatch(/^talk-\d+$/);
      expect(t.abstract.length).toBeGreaterThan(0);
      expect(t.speaker_ids.length).toBeGreaterThan(0);
      for (const s of t.speaker_ids) expect(ids.has(s), `${t.id} speaker ${s}`).toBe(true);
      expect(t.starts_at < t.ends_at).toBe(true);
      expect(t.starts_at.slice(0, 7)).toBe("2026-11");
    }
  });
});
