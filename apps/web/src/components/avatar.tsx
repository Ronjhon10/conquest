import type { CharacterClass } from "@conquest/contracts";

// Small SVG sprites are the spec's default until conference artwork is supplied.
// No user text enters the SVG markup; seed only selects from a fixed palette.
export function classSpriteSource(
  characterClass: CharacterClass | undefined,
  seed: string,
): string {
  const colors = ["#3269bd", "#8b42a8", "#327b55", "#b45b28"];
  const hash = [...seed].reduce(
    (value, c) => (value * 31 + c.charCodeAt(0)) >>> 0,
    0,
  );
  const color = colors[hash % colors.length];
  const equipment: Record<CharacterClass, string> = {
    knight: '<path d="M3 10h3v6H3zm10-4h1v10h-1zm-1 7h3v1h-3" fill="#bcc6d4"/>',
    wizard:
      '<path d="m8 1 4 5H4z" fill="#3943ac"/><path d="M13 8h1v10h-1z" fill="#98622c"/><path d="M12 6h3v3h-3z" fill="#e7bd4d"/>',
    rogue:
      '<path d="M4 4h8v6H4z" fill="#24384b"/><path d="M5 7h6v2H5z" fill="#e7bc94"/><path d="m13 11 1 1-3 4-1-1z" fill="#bcc6d4"/>',
    bard: '<path d="M4 4h8v2H4z" fill="#7e3f41"/><path d="M11 9h2v4h-2zM10 13h4v4h-4z" fill="#d7a455"/>',
  };
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="20" viewBox="0 0 16 20" shape-rendering="crispEdges"><path d="M5 10h6v6H5z" fill="${color}"/><path d="M6 4h4v6H6z" fill="#e7bc94"/><path d="M5 16h2v3H5zm4 0h2v3H9z" fill="#24384b"/><path d="M6 6h1v1H6zm3 0h1v1H9z" fill="#000"/>${characterClass ? equipment[characterClass] : ""}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
export function Avatar({
  name,
  photo,
  characterClass,
  seed = "conquest",
  size = 64,
}: {
  name: string;
  photo?: string | null;
  characterClass?: CharacterClass;
  seed?: string;
  size?: number;
}) {
  const hasPhoto = photo?.startsWith("data:image/jpeg;base64,");
  return (
    <img
      className={hasPhoto ? "avatar avatar-photo" : "avatar avatar-sprite"}
      src={hasPhoto && photo ? photo : classSpriteSource(characterClass, seed)}
      width={size}
      height={size}
      alt={
        hasPhoto
          ? `${name}'s profile photo`
          : `${name}'s ${characterClass ?? "adventurer"} character`
      }
    />
  );
}
