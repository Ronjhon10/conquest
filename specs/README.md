# Specs

What the product does, before the code says it.

## Rules

1. **Spec before code.** A behavior change starts as an edit to a spec. Code comes after and references the criteria it satisfies.
2. **Numbered acceptance criteria.** Each criterion has an ID like `XX-3`, and each ID has at least one test whose name starts with it, so a search for `XX-3` finds both.
3. **Non-goals are binding.** If it's a non-goal, don't build it during the hackathon, even if it's easy.
4. **Open questions block nothing.** Each one has a default we build until it's answered.
5. **Small is fine.** A hackathon spec can be half a page. It just has to be clear enough that two people (or two agents) build the same thing.

New spec: copy `_template.md`, pick the next free number (`000` is the overview), and add it to the map below.

## Map

| Spec | Module | Prefix | Owner |
| --- | --- | --- | --- |
| [000 Overview](000-overview.md) | architecture, contracts, lanes, demo path | `OV` | everyone |
| [010 Platform](010-platform.md) | Kubernetes, Radar, Dash0, Gitar, CI, deploy, `packages/telemetry` | `PL` | Platform lane (Jake Nef) |
| [020 Search](020-search.md) | `services/search-api`, talk + speaker indexes, KubeCon seed | `SR` | Search lane (Max) |
| [030 Game](030-game.md) | `services/game-api`, game state, XP, leaderboard | `GM` | Game lane (Jacob Bingham) |
| [040 Web](040-web.md) | `apps/web`, accessibility (Merge Forward), RUM | `WEB` | Web lane (Danny) |

Lanes, build order and the timeline are in [product/BUILD.md](../product/BUILD.md).
