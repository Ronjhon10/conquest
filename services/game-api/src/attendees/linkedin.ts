// 030 Behavior 5: normalize a pasted LinkedIn profile URL. Pure string work; the URL is never requested (GM-19).
const PROFILE = /^(?:https?:\/\/)?(?:[a-z]{2,3}\.)?(?:www\.)?linkedin\.com\/in\/([^/?#\s]+)\/?(?:[?#].*)?$/i;

/** Returns `https://www.linkedin.com/in/<slug>/`, or null when the input isn't a profile URL. */
export function normalizeLinkedInUrl(input: string): string | null {
  const m = PROFILE.exec(input.trim());
  return m ? `https://www.linkedin.com/in/${m[1]}/` : null;
}
