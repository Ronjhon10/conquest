# Demo script (two minutes)

Follows the 000 demo path. Record by 5:00 MT, submit by 5:30. Rehearse once against the live URL first.

**Before you record**

- Live URL: https://conquest.cnh.radarhq.io. Demo conference: KubeCon NA 2026, id `d2927cdd-f3e6-404f-b34f-4c4b766b8520` (8 made-up players already on it).
- Window A (attendee, phone width): `/c/d2927cdd-f3e6-404f-b34f-4c4b766b8520/join`
- Window B (monitor): `/organizer/d2927cdd-f3e6-404f-b34f-4c4b766b8520/live` (refreshes every 5 s)
- Sign up **once before recording** as a second attendee and create a party with them, then have them check into the talk you'll check into. The 1.25x party bonus only shows when a party member has already checked into the same talk (030 rule 7).
- Check-ins take a few seconds on the trial Elasticsearch (forced refresh per write, see evidence). Don't cut away while "Checking in…" shows.
- Use made-up profile text in the recording, never a real person's LinkedIn link.

| Time | Screen | Say |
| --- | --- | --- |
| 0:00–0:12 | Slide: problem | "Conferences are something you sit through. Attendees came for knowledge and connections, organizers want engagement, speakers want to know they mattered. Conquest makes the conference a game." |
| 0:12–0:25 | `/organizer/<conf>`: theme, quests, rooms with step-free notes, Dash0 link | "An organizer creates the conference and a theme. Their quests and sponsor quests, and which rooms aren't step-free." |
| 0:25–0:50 | Window A: join → photo → headline/about → class + suggested goals → map | "An attendee signs up in a few taps. Elasticsearch hybrid search (BM25 plus semantic embeddings, fused with RRF) ranks 480 real KubeCon talks against their goals. Each one is a boss on their map, with the reason it was picked." Toggle **list view** and **Step-free only**: "The map works with a screen reader and for step-free routes." |
| 0:50–1:20 | Boss page: **Check in** (show "Party bonus x1.25"), **Take photo**, **Give coin** with a note. Connect page: type a friend's code. Window B updates. | "At the conference you check into talks, with your party for a bonus. You take photos and scan new allies' codes. Coins thank the speaker. The leaderboard on the monitor is an Elasticsearch aggregation." |
| 1:20–1:35 | `/c/<conf>/recap` (Copy), `/organizer/<conf>/report`, `/s/<speaker>` | "Afterwards the attendee gets a recap post, the organizer gets a report, and the speaker sees their coins and notes." |
| 1:35–2:00 | Slides from `demo/evidence/` | One line per track, below. |

**Track slides (one line each, all real)**

- **Elasticsearch:** the only database. Hybrid ranking for the map; leaderboard and report are aggregations.
- **Radar:** runs on the `conquest` vcluster through Argo CD GitOps. Checks went from 3 Medium to 0 (`2026-11-09-1342-*`, `2026-11-09-1550-*`). Radar `diagnose` caught our own CPU-quota stall. AI investigation of game-api 503s (`2026-11-09-1540-dash0-xp-checkin-10s.md`).
- **Dash0:** traces, metrics and logs from both services. "Conquest live" dashboard, XP SLO and p95 check rule (`observability/dash0/`). The rule fired at p95 10.4 s and a trace pinned it on `refresh: wait_for`. Agent0 traced 31 error spans to a hardcoded conference id.
- **Gitar:** every feature merged through a Gitar-reviewed PR with repo rules. Gitar auto-fix commits are on PRs #27, #39, #44, #53, #55, #59 and #72.
- **Merge Forward:** list view by default with reduced motion, step-free filter marked in text, alt text on every avatar, keyboard flows.

Speak to what's actually shown. If something wasn't recorded working, cut that line rather than claim it.
