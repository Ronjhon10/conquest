import { isCharacterSheet } from "./character-sheet";
const sources = new Map<string, string>();
function sourceKey(conf: string, id: string) {
  return `conquest:${conf}:character-source:${id}`;
}
export function rememberCharacterSource(
  conf: string,
  id: string,
  photo: string | null,
) {
  const key = sourceKey(conf, id);
  if (photo) sources.set(key, photo);
  else sources.delete(key);
  try {
    if (photo) localStorage.setItem(key, photo);
    else localStorage.removeItem(key);
  } catch {
    /* Optional local reference; saved character is still on the attendee. */
  }
}
export function characterSource(conf: string, id: string): string | null {
  const key = sourceKey(conf, id);
  try {
    return localStorage.getItem(key) ?? sources.get(key) ?? null;
  } catch {
    return sources.get(key) ?? null;
  }
}
const UNAVAILABLE =
  "Character creation isn't available right now. Your current character is safe.";
const POLL_MS = 3_000;
const POLL_LIMIT_MS = 4 * 60_000;
function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason);
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", stop);
      resolve();
    }, ms);
    function stop() {
      clearTimeout(timer);
      reject(signal.reason);
    }
    signal.addEventListener("abort", stop, { once: true });
  });
}
// The gateway ends requests after 15 s, so POST only starts the job and the
// browser checks on it until the character is ready (about a minute).
export async function createCharacter(
  photo: string,
  signal: AbortSignal,
  pollMs = POLL_MS,
): Promise<{ photo: string | null; reason: string | null }> {
  const response = await fetch("/api/characters", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ photo }),
    signal,
  });
  if (!response.ok) throw new Error(UNAVAILABLE);
  let data = await response.json();
  if (typeof data.job === "string") {
    const job = data.job;
    const started = Date.now();
    let failures = 0;
    while (true) {
      if (Date.now() - started > POLL_LIMIT_MS) throw new Error(UNAVAILABLE);
      await wait(pollMs, signal);
      const check = await fetch(
        `/api/characters?job=${encodeURIComponent(job)}`,
        { signal, cache: "no-store" },
      );
      if (!check.ok) {
        if (++failures >= 3) throw new Error(UNAVAILABLE);
        continue;
      }
      failures = 0;
      data = await check.json();
      if (data.pending !== true) break;
    }
  }
  if (data.photo !== null && !isCharacterSheet(data.photo))
    throw new Error(
      "The character couldn't be prepared. Try again or keep the default.",
    );
  return {
    photo: data.photo,
    reason: typeof data.reason === "string" ? data.reason : null,
  };
}
