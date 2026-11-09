# MapMarker

The next boss on the map: a white `cq-ring` around the boss sprite and a blue `cq-marker` label above it ("Next · 2:00 PM").

- Only the next boss gets the ring and blue label. Other bosses get a chip: `Done` (ink) or their start time (`cq-chip--light`).
- These are the only brand elements drawn on top of the dungeon art. Each carries its own ink border so it reads on any theme.
- The consumer positions them from the boss's position in the map image.
