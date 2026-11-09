/** Vector version of the approved stepped portal and blue path. */
export function PortalMark({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 68" fill="none" aria-hidden="true" focusable="false">
      <path fill="#000" d="M20 4H44V12H52V20H60V58H50L44 52V28L40 24H24L20 28V60H4V20H12V12H20Z" />
      <path fill="#0000FF" d="M24 48H40L58 64H42Z" />
    </svg>
  );
}
