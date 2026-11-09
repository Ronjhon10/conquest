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
export async function createCharacter(
  photo: string,
  signal: AbortSignal,
): Promise<{ photo: string | null; reason: string | null }> {
  const response = await fetch("/api/characters", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ photo }),
    signal,
  });
  if (!response.ok)
    throw new Error(
      "Character creation isn't available right now. Your current character is safe.",
    );
  const data = await response.json();
  if (data.photo !== null && !isCharacterSheet(data.photo))
    throw new Error(
      "The character couldn't be prepared. Try again or keep the default.",
    );
  return {
    photo: data.photo,
    reason: typeof data.reason === "string" ? data.reason : null,
  };
}
