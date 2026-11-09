// Turns the public KubeCon NA 2026 schedule (Sessionize "all" data embedded in the official
// Linux Foundation schedule page) into Talk and Speaker documents (020 Behavior 1, SR-1).
// Pure functions only: scrape.ts does the one network request.
import { Speaker, Talk } from "@conquest/contracts";

// ---------- the parts of Sessionize's "all" export we read ----------

export type SzAnswer = { questionId: number; answerValue: string | null };
export type SzSession = {
  id: string;
  title: string;
  description: string | null;
  startsAt: string; // venue-local, no offset: "2026-11-10T11:00:00"
  endsAt: string;
  isServiceSession: boolean;
  speakers: string[];
  categoryItems: number[];
  roomId: number | null;
  status?: string | null;
};
export type SzSpeaker = {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  bio: string | null;
  tagLine: string | null;
  profilePicture: string | null;
  questionAnswers: SzAnswer[];
};
export type SzCategory = { id: number; title: string; items: { id: number; name: string }[] };
export type SzQuestion = { id: number; question: string };
export type SzAll = {
  sessions: SzSession[];
  speakers: SzSpeaker[];
  rooms: { id: number; name: string }[];
  categories: SzCategory[];
  questions: SzQuestion[];
};

export type SeedRecord = { type: "talk"; doc: Talk } | { type: "speaker"; doc: Speaker };

/** Salt Lake City is on MST (UTC-7) for the whole event (DST ended 2026-11-01). */
export const VENUE_UTC_OFFSET = "-07:00";

/** Session types that are not talks (020 Behavior 1: drop breaks, meals, registration). */
const DROP_TRACKS = new Set(["Registration", "Breaks"]);
/** Sub-topics that are logistics, not topics. */
const DROP_TAGS = new Set(["separate registration required"]);

/** Pull the embedded schedule JSON out of the LF schedule page HTML. */
export function extractScheduleJson(html: string): SzAll {
  const m = html.match(/<script type="application\/json" class="sched-data">([\s\S]*?)<\/script>/);
  if (!m?.[1]) throw new Error("schedule data block not found in page");
  const data = JSON.parse(m[1]) as { all?: SzAll };
  if (!data.all?.sessions?.length) throw new Error("schedule data block has no sessions");
  return data.all;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

/** Sessionize descriptions are HTML; the index wants plain text. */
export function htmlToText(html: string | null | undefined): string {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|li|ul|ol|h\d)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, "")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (all, name: string) => ENTITIES[name.toLowerCase()] ?? all)
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** "⚡ Lightning Talks" -> "Lightning Talks". */
export function stripEmoji(s: string): string {
  return s.replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, "").trim();
}

/** Venue-local "2026-11-10T11:00:00" -> UTC "2026-11-10T18:00:00.000Z". */
export function toUtc(local: string, offset = VENUE_UTC_OFFSET): string {
  const d = new Date(`${local}${offset}`);
  if (Number.isNaN(d.getTime())) throw new Error(`bad time ${local}`);
  return d.toISOString();
}

export function slugify(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function answer(sp: SzSpeaker, questionId: number | undefined): string | null {
  if (questionId === undefined) return null;
  const v = sp.questionAnswers.find((a) => a.questionId === questionId)?.answerValue?.trim();
  return v ? v : null;
}

/** Build every talk with a speaker and an abstract, plus the speakers those talks reference. */
export function transform(all: SzAll): { talks: Talk[]; speakers: Speaker[] } {
  const rooms = new Map(all.rooms.map((r) => [r.id, r.name]));
  const catByTitle = new Map(all.categories.map((c) => [c.title, c]));
  const itemsOf = (title: string) => new Map((catByTitle.get(title)?.items ?? []).map((i) => [i.id, i.name]));
  const trackItems = itemsOf("All Sessions");
  const levelItems = itemsOf("Audience Level");
  const tagItems = [itemsOf("SubTopic"), itemsOf("CNCF Projects"), itemsOf("End User Programming")];
  const q = (name: string) => all.questions.find((x) => x.question === name)?.id;
  const qCompany = q("Company");
  const qCompanyOverride = q("Company Override");
  const qNameDisplay = q("Speaker Name Display");

  // Speaker ids: spk-<slug>, unique even when two people share a name.
  const speakerId = new Map<string, string>();
  const used = new Set<string>();
  for (const sp of [...all.speakers].sort((a, b) => a.id.localeCompare(b.id))) {
    const base = `spk-${slugify(sp.fullName || `${sp.firstName} ${sp.lastName}`) || "speaker"}`;
    let id = base;
    for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
    used.add(id);
    speakerId.set(sp.id, id);
  }
  const szSpeakers = new Map(all.speakers.map((s) => [s.id, s]));

  const talks: Talk[] = [];
  for (const s of all.sessions) {
    if (s.isServiceSession || (s.status && s.status !== "Accepted")) continue;
    const abstract = htmlToText(s.description);
    const speakerIds = s.speakers.filter((id) => szSpeakers.has(id)).map((id) => speakerId.get(id)!);
    if (!abstract || speakerIds.length === 0) continue;

    const trackRaw = s.categoryItems.map((id) => trackItems.get(id)).find((x) => x !== undefined) ?? null;
    if (trackRaw && DROP_TRACKS.has(trackRaw)) continue;
    const track = trackRaw ? stripEmoji(trackRaw) : null;
    const level = s.categoryItems.map((id) => levelItems.get(id)).find((x) => x !== undefined) ?? null;

    const tags = new Set<string>();
    for (const items of [trackItems, ...tagItems])
      for (const id of s.categoryItems) {
        const name = items.get(id);
        if (name && !DROP_TRACKS.has(name)) tags.add(stripEmoji(name).toLowerCase());
      }
    for (const t of DROP_TAGS) tags.delete(t);

    talks.push(
      Talk.parse({
        id: `talk-${s.id}`,
        title: htmlToText(s.title),
        abstract,
        speaker_ids: [...new Set(speakerIds)],
        room: (s.roomId !== null && rooms.get(s.roomId)) || "TBA",
        starts_at: toUtc(s.startsAt),
        ends_at: toUtc(s.endsAt),
        track,
        level,
        tags: [...tags],
      }),
    );
  }
  talks.sort((a, b) => a.starts_at.localeCompare(b.starts_at) || a.id.localeCompare(b.id));

  const referenced = new Set(talks.flatMap((t) => t.speaker_ids));
  const speakers: Speaker[] = [];
  for (const sp of all.speakers) {
    const id = speakerId.get(sp.id)!;
    if (!referenced.has(id)) continue;
    speakers.push(
      Speaker.parse({
        id,
        name: answer(sp, qNameDisplay) ?? sp.fullName,
        company: answer(sp, qCompanyOverride) ?? answer(sp, qCompany),
        bio: htmlToText(sp.bio) || (sp.tagLine ?? ""),
        photo_url: sp.profilePicture || null,
      }),
    );
  }
  speakers.sort((a, b) => a.id.localeCompare(b.id));
  return { talks, speakers };
}

/** NDJSON: speakers first, then talks, one `{type, doc}` record per line. */
export function toNdjson(data: { talks: Talk[]; speakers: Speaker[] }): string {
  const records: SeedRecord[] = [
    ...data.speakers.map((doc) => ({ type: "speaker" as const, doc })),
    ...data.talks.map((doc) => ({ type: "talk" as const, doc })),
  ];
  return records.map((r) => JSON.stringify(r)).join("\n") + "\n";
}

export function parseNdjson(text: string): { talks: Talk[]; speakers: Speaker[] } {
  const talks: Talk[] = [];
  const speakers: Speaker[] = [];
  for (const [i, line] of text.split("\n").entries()) {
    if (!line.trim()) continue;
    const r = JSON.parse(line) as { type?: string; doc?: unknown };
    if (r.type === "talk") talks.push(Talk.parse(r.doc));
    else if (r.type === "speaker") speakers.push(Speaker.parse(r.doc));
    else throw new Error(`line ${i + 1}: unknown record type ${String(r.type)}`);
  }
  return { talks, speakers };
}
