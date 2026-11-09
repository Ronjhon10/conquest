/** Vector version of the approved stepped portal and blue path, traced from the logo sheet. */
export function PortalMark({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 314 345" fill="none" aria-hidden="true" focusable="false">
      <path fill="#000" d="M91 0H226V43H269V85H314V310H273L226 272V134L217 131L203 120V114Q203 105 192 105H120Q109 105 109 114V120L95 131L85 134V322H0V85H48V43H91Z" />
      <path fill="#0000FF" d="M109 271H201L292 345H200Z" />
    </svg>
  );
}
