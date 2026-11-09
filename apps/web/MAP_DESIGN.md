# Map page reference

The current reference is the user-supplied [Cobalt phone map](design-references/cobalt-phone-map.png), preserved unchanged. The earlier structural reference is [02 Map · 16-bit](https://claude.ai/artifact/L6M24BzoY4UfwAL2cJpAV3#play-28ecf9fefbf4).

The entire `/c/[conf]/map` route is one phone-first screen: Conquest/conference identity, player portrait/name/level/XP/coins, day and access controls, connected floor plan, selected encounter, Quests/Talk actions/Connect, and five-link attendee navigation. There is no surrounding website header, demo banner, preview heading, player strip, quest sidebar or website footer on this route. Other routes retain their existing shell.

`DungeonMap` has an optional `fullPage` prop; the map route enables it, embedded previews keep the compact component. Full-page mode uses normal page scrolling and safe-area padding. The layout narrows and stacks the header on small phones; wide screens center the phone-oriented composition at 720px maximum. Character PNGs and Avatar are unchanged. No new bitmap artwork was generated for this revision.

Quests opens an in-screen panel, whose close control returns focus to the trigger. Encounter and connect actions use the existing routes. List view, reduced-motion default, venue-time day selection and step-free filtering remain functional. The UI does not invent check-in completion, quest progress or player position tracking.

Automated checks cover the integrated shell, player metadata, navigation, quest controls and existing map behavior. Browser visual verification of the implementation remains pending.

Map controls use the shared `cq-btn`/`cq-btn--secondary` classes from other pages. Keep typography, borders, radii, hard shadows and press behavior in the shared styles; map-specific CSS should only adapt layout and sizing.
