import Image from "next/image";
import type { CharacterClass } from "@conquest/contracts";
import { isCharacterSheet, outfitPosition } from "../lib/character-sheet";

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
  eager = false,
}: {
  name: string;
  photo?: string | null;
  characterClass?: CharacterClass;
  seed?: string;
  size?: number;
  variant?: "portrait" | "full";
  /** Load immediately; for art above the fold. */
  eager?: boolean;
}) {
  if (isCharacterSheet(photo)) {
    const { x, y } = outfitPosition(characterClass);
    const viewBox =
      variant === "full"
        ? `${x * 128} ${y * 128} 128 128`
        : `${x * 128 + 24} ${y * 128} 80 80`;
    return (
      <span
        className={`avatar avatar-sprite avatar-${variant}`}
        style={{ width: size, height: size }}
      >
        <svg
          width={size}
          height={size}
          viewBox={viewBox}
          role="img"
          aria-label={`${name}'s ${characterClass ?? "adventurer"} game character`}
          style={{
            width: "100%",
            height: "100%",
            imageRendering: "pixelated",
            overflow: "hidden",
          }}
        >
          <image href={photo} x="0" y="0" width="256" height="256" />
        </svg>
      </span>
    );
  }
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
      <Image
        className="avatar-art"
        src={classSpriteSource(characterClass, seed)}
        width={size}
        height={size}
        alt={`${name}'s ${characterClass ?? "adventurer"} character`}
        sizes={`${Math.ceil(size * (variant === "portrait" ? 2.4 : 1))}px`}
        quality={100}
        loading={eager ? "eager" : undefined}
      />
    </span>
  );
}
