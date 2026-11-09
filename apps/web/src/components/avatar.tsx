import type { CharacterClass } from "@conquest/contracts";

const characterArt: Record<CharacterClass, string> = {
  knight: "/characters/knight-v1.png",
  wizard: "/characters/wizard-v1.png",
  rogue: "/characters/rogue-v1.png",
  bard: "/characters/bard-v1.png",
};

// Keep the existing seam for callers. Curated class art replaces the tiny seeded
// placeholders; avatar_seed remains in the attendee contract for future variants.
export function classSpriteSource(
  characterClass: CharacterClass | undefined,
  _seed: string,
): string {
  return characterArt[characterClass ?? "knight"];
}
export function Avatar({
  name,
  photo,
  characterClass,
  seed = "conquest",
  size = 64,
  variant = "portrait",
}: {
  name: string;
  photo?: string | null;
  characterClass?: CharacterClass;
  seed?: string;
  size?: number;
  variant?: "portrait" | "full";
}) {
  if (photo?.startsWith("data:image/jpeg;base64,")) {
    return (
      <img
        className="avatar avatar-photo"
        src={photo}
        width={size}
        height={size}
        alt={`${name}'s profile photo`}
      />
    );
  }
  return (
    <span
      className={`avatar avatar-sprite avatar-${variant}`}
      style={{ width: size, height: size }}
    >
      <img
        className="avatar-art"
        src={classSpriteSource(characterClass, seed)}
        width={size}
        height={size}
        alt={`${name}'s ${characterClass ?? "adventurer"} character`}
        decoding="async"
      />
    </span>
  );
}
