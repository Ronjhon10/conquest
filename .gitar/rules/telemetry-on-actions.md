---
title: "Player actions are telemetry"
description: "Every new player action and service must be traced and measured per the 000 telemetry conventions (Dash0)."
when: "A PR adds or changes an XP action, a game or search route, or a new service"
actions: "Check for the span, metric and attributes the spec requires and suggest the missing instrumentation"
---

Observability is part of Conquest (Dash0 track). Conventions are in `specs/000-overview.md` "Telemetry conventions" and `specs/030-game.md` Behavior 20.

1. New services call `startTelemetry("<service-name>")` before anything else.
2. Every XP award emits span `xp.award` with `conquest.conference.id`, `conquest.xp.kind`, `conquest.xp.amount`, `conquest.party.size`, and increments `conquest.xp.awarded`.
3. Search ranking records `conquest.search.rank.duration`; leaderboard reads record `conquest.leaderboard.duration`.
4. Custom attributes use the `conquest.` prefix and hold IDs and numbers only.

Suggest the missing code. Don't block a PR for telemetry alone unless it's an XP action.
