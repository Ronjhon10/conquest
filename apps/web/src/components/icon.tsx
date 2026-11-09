import type { CharacterClass } from "@conquest/contracts";

type IconName =
  "arrow-right" | "arrow-up-right" | "check" | "plus" | CharacterClass;
const paths: Record<IconName, React.ReactNode> = {
  "arrow-right": (
    <>
      <path d="M3 12h17m-6-6 6 6-6 6" />
      <path d="M4 8h4M4 16h4" />
    </>
  ),
  "arrow-up-right": (
    <>
      <path d="M8 5h11v11M19 5 5 19" />
      <path d="M5 5H3v16h16v-2" />
    </>
  ),
  check: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="m7 12 3 3 7-7" />
    </>
  ),
  plus: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v8M8 12h8" />
    </>
  ),
  knight: (
    <>
      <path d="m12 2 8 3v6c0 5-5 9-8 11-3-2-8-6-8-11V5z" />
      <path d="m12 6 4 2v3c0 3-2 5-4 7-2-2-4-4-4-7V8zM12 6v12" />
    </>
  ),
  wizard: (
    <>
      <path d="M3 5c4-1 6 0 9 2 3-2 5-3 9-2v14c-4-1-6 0-9 2-3-2-5-3-9-2zM12 7v14" />
      <path d="M6 9h3M6 12h3m7-3 1 2 2 1-2 1-1 2-1-2-2-1 2-1z" />
    </>
  ),
  rogue: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m16 8-2 6-6 2 2-6zM12 3v2M12 19v2M3 12h2M19 12h2" />
    </>
  ),
  bard: (
    <>
      <path d="M10 16V5l10-2v11M10 8l10-2" />
      <ellipse cx="7" cy="17" rx="3" ry="3" />
      <ellipse cx="17" cy="15" rx="3" ry="3" />
      <path d="M3 4h3M4.5 2.5v3" />
    </>
  ),
};
/** Decorative companion to visible labels. State is announced through aria-pressed. */
export function Icon({ name }: { name: IconName }) {
  return (
    <svg
      className="ui-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {paths[name]}
    </svg>
  );
}
