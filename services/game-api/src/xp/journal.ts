// Commit XP and an event outbox in the same versioned attendee document. The public
// Attendee schema strips this storage-only metadata; it never appears in API responses.
import { Attendee, INDEX, type CoinGift, type XpEvent } from "@conquest/contracts";
import { setTimeout as delay } from "node:timers/promises";
import type { Deps } from "../deps";
import { ApiError } from "../http";
import { UPDATE_RETRIES } from "../store/repos";
import { AlreadyExistsError, VersionConflictError } from "../store/store";
import { levelForXp, PHOTO_LIMIT } from "./rules";

type Journal = { events: XpEvent[]; pending: XpEvent[]; gifts?: CoinGift[]; pendingGifts?: CoinGift[] };
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
      _xp_journal: { ...journal, events: [...journal.events, event], pending: [...journal.pending, event] },
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

/** Coin debit and its pending gift are one versioned write, just like XP and its events. */
export async function commitGift(deps: Deps, gift: CoinGift): Promise<Attendee> {
  const legacy = await deps.repos.coins.find({ from_attendee_id: gift.from_attendee_id });
  for (let attempt = 0; ; attempt++) {
    const current = await deps.store.get<StoredAttendee>(INDEX.attendees, gift.from_attendee_id);
    if (!current) throw new ApiError(404, "not_found", "Attendee not found");
    const journal = current.doc._xp_journal ?? { events: [], pending: [] };
    if ([...legacy, ...(journal.gifts ?? [])].some((g) => g.talk_id === gift.talk_id)) {
      throw new ApiError(409, "already_gifted", "You already gave a coin for this talk");
    }
    if (current.doc.coins < 1) throw new ApiError(409, "no_coins", "No coins left to give");
    const next: StoredAttendee = {
      ...current.doc, coins: current.doc.coins - 1,
      _xp_journal: { ...journal, gifts: [...(journal.gifts ?? []), gift], pendingGifts: [...(journal.pendingGifts ?? []), gift] },
      _xp_pending: true,
    };
    try {
      await deps.store.put(INDEX.attendees, gift.from_attendee_id, next, current.version);
      return Attendee.parse(next);
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
  const pendingGifts = snapshot?.doc._xp_journal?.pendingGifts ?? [];
  if (!pending.length && !pendingGifts.length) return;
  await publishJournal(deps, pending, pendingGifts);
  const published = new Set(pending.map((e) => e.id));
  const publishedGifts = new Set(pendingGifts.map((g) => g.id));
  // Never clear a newer award added while this snapshot was being published.
  for (let attempt = 0; ; attempt++) {
    const current = await deps.store.get<StoredAttendee>(INDEX.attendees, attendeeId);
    const journal = current?.doc._xp_journal;
    if (!current || !journal) return;
    const remaining = journal.pending.filter((e) => !published.has(e.id));
    const remainingGifts = (journal.pendingGifts ?? []).filter((g) => !publishedGifts.has(g.id));
    try {
      await deps.store.put(INDEX.attendees, attendeeId, {
        ...current.doc, _xp_journal: { ...journal, pending: remaining, pendingGifts: remainingGifts }, _xp_pending: remaining.length + remainingGifts.length > 0,
      }, current.version);
      return;
    } catch (err) {
      if (!(err instanceof VersionConflictError) || attempt >= UPDATE_RETRIES) throw err;
      await delay(4 ** attempt);
    }
  }
}

/**
 * Repair pending projections before returning conference aggregates (also runs on startup).
 * `readOnly` (leaderboard, report, speaker page): publish pending events and gifts so aggregates
 * count them, but never rewrite attendee documents. A pending attendee is usually a check-in still
 * in flight; rewriting it from a read raced that request's own writes and caused 409 version
 * conflicts, 500s and timeouts under load (P.W2, load test 2026-11-09 15:35 MT). Creates are
 * idempotent, and the request that owns the award still clears its own pending flag.
 */
export async function recoverPendingAwards(deps: Deps, conferenceId?: string, opts: { readOnly?: boolean } = {}): Promise<void> {
  const filter = { _xp_pending: true, ...(conferenceId ? { conference_id: conferenceId } : {}) };
  if (opts.readOnly) {
    for (const attendee of await deps.store.find<StoredAttendee>(INDEX.attendees, filter)) {
      await publishJournal(deps, attendee._xp_journal?.pending ?? [], attendee._xp_journal?.pendingGifts ?? []);
    }
    return;
  }
  for (;;) {
    const pending = await deps.store.find<Attendee>(INDEX.attendees, filter);
    if (!pending.length) return;
    for (const attendee of pending) await publishPendingAwards(deps, attendee.id);
  }
}

/** Create each pending event and gift; one that already exists was published before (idempotent). */
async function publishJournal(deps: Deps, pending: XpEvent[], pendingGifts: CoinGift[]): Promise<void> {
  for (const event of pending) {
    try {
      await deps.repos.xpEvents.create(event);
    } catch (err) {
      if (!(err instanceof AlreadyExistsError)) throw err;
    }
  }
  for (const gift of pendingGifts) {
    try {
      await deps.repos.coins.create(gift);
    } catch (err) {
      if (!(err instanceof AlreadyExistsError)) throw err;
    }
  }
}
