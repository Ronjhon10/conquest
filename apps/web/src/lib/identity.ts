const memory = new Map<string, string>();
export function attendeeKey(conf: string) {
  return `conquest:${conf}:attendee`;
}
export function rememberAttendee(conf: string, id: string): void {
  memory.set(conf, id);
  try {
    localStorage.setItem(attendeeKey(conf), id);
  } catch {
    /* Private browsers can still continue within this tab. */
  }
}
export function currentAttendee(conf: string): string | null {
  try {
    return localStorage.getItem(attendeeKey(conf)) ?? memory.get(conf) ?? null;
  } catch {
    return memory.get(conf) ?? null;
  }
}

export function forgetAttendee(conf: string): void {
  memory.delete(conf);
  try {
    localStorage.removeItem(attendeeKey(conf));
  } catch {
    /* Memory identity is already cleared. */
  }
}
