// Commit XP and an event outbox in the same versioned attendee document. The public
// Attendee schema strips this storage-only metadata; it never appears in API responses.
import { Attendee, INDEX, type XpEvent } from "@conquest/contracts";
import { setTimeout as delay } from "node:timers/promises";
import type { Deps } from "../deps";
import { ApiError } from "../http";
import { UPDATE_RETRIES } from "../store/repos";
import { AlreadyExistsError, VersionConflictError } from "../store/store";
import { levelForXp, PHOTO_LIMIT } from "./rules";

type Journal = { events: XpEvent[]; pending: XpEvent[] };
type StoredAttendee = Attendee & { _xp_journal?: Journal; _xp_pending?: boolean };

/** Retry conflicts before any event is published, so an exhausted retry leaves no phantom XP. */
export async function commitAward(deps: Deps, event: XpEvent, coins: number) {
  // Includes pre-journal events, preserving limits for attendees created before this fix.
  const legacy = await deps.repos.xpEvents.find({ attendee_id: event.attendee_id });
  for (let attempt = 0; ; attempt++) {
    const current = await deps.store.get<StoredAttendee>(INDEX.attendees, event.attendee_id);
    if (!current) throw new ApiError(404, "not_found", "Unknown attendee");
    const journal = current.doc._xp_journal ?? { events: [], pending: [] };
    const history = [...new Map([...legacy, ...journal.events].map((e) => [e.id, e])).values()];
    const prior = history.find((e) => e.kind === event.kind && (
      event.kind === "checkin" ? e.talk_id === event.talk_id :
      event.kind === "network" ? e.other_attendee_id === event.other_attendee_id :
      event.kind === "quest" ? e.quest_id === event.quest_id : e.id === event.id
    ));
    if (prior) return { event: prior, attendee: Attendee.parse(current.doc), created: false };
    if (event.kind === "photo" && history.filter((e) => e.kind === "photo").length >= PHOTO_LIMIT) {
      throw new ApiError(409, "photo_limit", `At most ${PHOTO_LIMIT} photos`);
    }
    const xp = current.doc.xp + event.xp;
    const next: StoredAttendee = {
      ...current.doc, xp, level: levelForXp(xp), coins: current.doc.coins + coins,
      _xp_journal: { events: [...journal.events, event], pending: [...journal.pending, event] },
      _xp_pending: true,
    };
    try {
      await deps.store.put(INDEX.attendees, event.attendee_id, next, current.version);
      return { event, attendee: Attendee.parse(next), created: true };
    } catch (err) {
      if (!(err instanceof VersionConflictError) || attempt >= UPDATE_RETRIES) throw err;
      await delay(4 ** attempt);
    }
  }
}

/** Idempotent outbox replay works after a process restart or a lost Elasticsearch response. */
export async function publishPendingAwards(deps: Deps, attendeeId: string): Promise<void> {
  const snapshot = await deps.store.get<StoredAttendee>(INDEX.attendees, attendeeId);
  const pending = snapshot?.doc._xp_journal?.pending ?? [];
  if (!pending.length) return;
  for (const event of pending) {
    try {
      await deps.repos.xpEvents.create(event);
    } catch (err) {
      if (!(err instanceof AlreadyExistsError)) throw err;
    }
  }
  const published = new Set(pending.map((e) => e.id));
  // Never clear a newer award added while this snapshot was being published.
  for (let attempt = 0; ; attempt++) {
    const current = await deps.store.get<StoredAttendee>(INDEX.attendees, attendeeId);
    const journal = current?.doc._xp_journal;
    if (!current || !journal) return;
    const remaining = journal.pending.filter((e) => !published.has(e.id));
    try {
      await deps.store.put(INDEX.attendees, attendeeId, {
        ...current.doc, _xp_journal: { ...journal, pending: remaining }, _xp_pending: remaining.length > 0,
      }, current.version);
      return;
    } catch (err) {
      if (!(err instanceof VersionConflictError) || attempt >= UPDATE_RETRIES) throw err;
      await delay(4 ** attempt);
    }
  }
}

/** Repair pending projections before returning conference aggregates (also runs on startup). */
export async function recoverPendingAwards(deps: Deps, conferenceId?: string): Promise<void> {
  const filter = { _xp_pending: true, ...(conferenceId ? { conference_id: conferenceId } : {}) };
  for (;;) {
    const pending = await deps.store.find<Attendee>(INDEX.attendees, filter);
    if (!pending.length) return;
    for (const attendee of pending) await publishPendingAwards(deps, attendee.id);
  }
}
