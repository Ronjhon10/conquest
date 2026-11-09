import { createHash } from "node:crypto";
import type { Deps } from "../deps";
import { scanRepo } from "../store/repos";

/** One atomic create key per normalized conference/profile pair, independent of search refresh. */
export function linkedAttendeeId(conferenceId: string, url: string): string {
  return `att-link-${createHash("sha256").update(JSON.stringify([conferenceId, url])).digest("hex")}`;
}

export async function existingLinkedAttendee(deps: Deps, conferenceId: string, url: string) {
  const canonical = await deps.repos.attendees.get(linkedAttendeeId(conferenceId, url));
  if (canonical) return canonical;
  // Older indexes kept linkedin_url unindexed, and that flag cannot be changed in place.
  // Read legacy source values instead of issuing a term query that fails on those indexes.
  for await (const attendee of scanRepo(deps.repos.attendees, { conference_id: conferenceId })) {
    if (attendee.linkedin_url === url) return attendee;
  }
  return null;
}
