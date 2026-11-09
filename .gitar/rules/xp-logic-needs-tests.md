---
title: "XP logic needs criterion tests"
description: "Changes to game rules (XP, party bonus, coins, levels, quests) must come with tests named by GM criterion IDs."
when: "A PR changes files under services/game-api/src/xp/ or changes XP amounts, the party multiplier, coin rules, level formula or quest completion anywhere"
actions: "Check for matching GM-* tests and request changes if they are missing or don't cover the change"
---

Conquest's game rules are specified in `specs/030-game.md` (Behavior 6-12, criteria GM-6 to GM-11).

When this PR changes XP amounts, the 1.25x party multiplier, photo/check-in/network limits, coin rules, the level formula or quest completion:

1. Find tests whose names start with the GM criterion IDs for the changed behavior.
2. If the change has no such test, or the test still asserts the old numbers, request changes and name the missing criterion IDs.
3. If the numbers differ from `specs/030-game.md`, say so and ask whether the spec was updated in the same PR.
4. Check the rule values still live only in `services/game-api/src/xp/rules.ts`.
