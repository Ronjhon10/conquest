# ConQuest portal logo

Approved on 2026-11-09: a black stepped dungeon doorway with a blue path leading
into the next quest. This replaces the text-only brand and the map's generic sword.

- [Standalone transparent SVG](../../apps/web/public/brand/conquest-portal.svg)
- [Full lockup SVG, portal + lettering](../../apps/web/public/brand/conquest-logo.svg)
- [Lettering-only SVG](../../apps/web/public/brand/conquest-wordmark.svg)
- [Shared lettering component](../../apps/web/src/components/wordmark.tsx)
- [Shared vector geometry](../../apps/web/src/components/portal-mark.tsx)
- [Shared Brand component](../../apps/web/src/components/brand.tsx)
- [Browser favicon](../../apps/web/app/icon.svg)
- [180 px Apple home-screen icon](../../apps/web/app/apple-icon.tsx)

Use `Brand` in headers, footers and map HUDs. Its `compact` variant fits small
interfaces. `onDark` adds a white tile behind the black portal and makes the
wordmark white. Keep the mark decorative beside the accessible text.
Home links retain the accessible name "Conquest home" and a 44 px tap target.

The wordmark is **ConQuest**, in the custom chunky lettering from the approved logo
sheet (traced to vector, not a font). Both the portal and the lettering were traced
from that sheet on 2026-11-09. Keep the
black portal and #0000FF path together. Do not recolor for conference themes,
stretch, add texture, or put the black mark directly on dark scenery.

`PortalMark` is the runtime source for the mark and generated Apple icon.
When geometry changes, update the standalone SVG and favicon to match.
Next's file conventions register the favicon and Apple icon automatically.
The vector assets need no remote font, image request, or new package.
