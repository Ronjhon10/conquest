# Hackathon tool research (Elasticsearch, Gitar, Dash0, Radar)

Snapshot from 2026-11-09, written down from a teammate's message about their tool research. The full write-up is a Cursor canvas that needs a login: https://cursor.com/canvas/store-79d667e3-7c7c-4e4e-9db3-c4fea7ecd666/2398ad02-5f49-481d-9d57-2e8141c0446f. It covers how each tool works, setup steps, effort-rated ideas, what each judge scores and a 2-minute demo script. **This file only has what was in the message.** Anything marked *unverified* hasn't been checked against the canvas or the tools' docs.

## The biggest finding

Judges score **how we build during the day**, not just the final product.

- **Gitar** wants features going through pull requests it reviewed all day.
- **Dash0 and Radar** want something real found and fixed today.
- So: **install Gitar and Dash0 now**, and use every tool in the process of building, not only in the final project. See [`product/TOOLING.md`](../product/TOOLING.md).

## Radar is easier than we thought

- Organizers give each team a cluster at `join.cnh.radarhq.io`.
- They also provide a starter repo, [skyhook-io/cnh-starter](https://github.com/skyhook-io/cnh-starter), which **deploys automatically whenever you push to `main`**.
- We only need **one AI investigation**. It can be a healthy all-clear.
- We also need before and after screenshots of Radar's checks.
- The starter repo says **not to break things on purpose** for the demo, so the earlier "break it on stage" idea is dropped. (Our spec already says never inject a fault: `specs/010-platform.md` Behavior 6.)

## Ideas (just ideas, not decided)

### Elasticsearch
- Put XP events in Elasticsearch so its counting features (aggregations) drive the leaderboard. That makes it clearly the core data layer.
- Quest alerts: a new or moved talk pings matching players with "A new boss appeared."

### Gitar
- Write the team's rules into the repo. Examples: XP math needs tests, and theme changes need alt text and good color contrast.
- The trial only allows **5 custom rules**, so pick them carefully. (`specs/010-platform.md` Behavior 7 currently lists five rules, so we're at the limit.)

### Dash0
- Track the phone app's activity too, which the judges ask for by name.
- Set a "Dungeon Health" reliability target (SLO), which earns a bonus point.
- Strongest moment: Agent0 finds a real slowdown and opens a fix that Gitar then reviews, so one story covers two tracks.

## Demo notes

- Gitar reviews take a few minutes, so **pre-record that part** of the demo.

## Open questions

- The Radar starter repo auto-deploys on push to `main`. `specs/010-platform.md` Behavior 8 says a human deploys by updating the image tag. Which wins? *Unverified:* whether we use the starter repo as is, or only borrow its deploy setup.
- Which five Gitar rules do we keep, and do they match the five already in the platform spec?
- Does the "Dungeon Health" target replace or sit beside the XP SLO in the platform spec?
