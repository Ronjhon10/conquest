import type { CharacterClass } from "@conquest/contracts";

// JPEG COM metadata identifies the four outfit cells without changing the API.
export const SHEET_MARKER = "CONQUEST_WARDROBE_V1";
export const JPEG_PREFIX = "data:image/jpeg;base64,";
type CharacterSheet = string & { readonly __characterSheet: true };
export const CHARACTER_CLASSES: CharacterClass[] = [
  "knight",
  "wizard",
  "rogue",
  "bard",
];
export function isCharacterSheet(
  photo: string | null | undefined,
): photo is CharacterSheet {
  if (!photo?.startsWith(JPEG_PREFIX)) return false;
  try {
    return atob(
      photo.slice(JPEG_PREFIX.length, JPEG_PREFIX.length + 256),
    ).includes(SHEET_MARKER);
  } catch {
    return false;
  }
}
export function outfitPosition(characterClass: CharacterClass = "knight") {
  const index = CHARACTER_CLASSES.indexOf(characterClass);
  return { x: index % 2, y: Math.floor(index / 2) };
}
