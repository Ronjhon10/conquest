// Talk times shown to attendees. The conference runs on Salt Lake City time,
// whatever timezone the attendee's phone (or the server) is set to.
export const CONFERENCE_TIME_ZONE = "America/Denver";

const weekdayFmt = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  timeZone: CONFERENCE_TIME_ZONE,
});

const clock = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: CONFERENCE_TIME_ZONE,
});

/** "Tue 9:00 AM": the talk's weekday and start time at the venue. */
export function formatTalkTime(iso: string): string {
  const start = new Date(iso);
  return `${weekdayFmt.format(start)} ${clock.format(start)}`;
}
