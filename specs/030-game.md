# 030: Game

Status: Accepted
Prefix: `GM`
Lane: Game
Owner: Jacob Bingham

## Purpose

The rules of Conquest and all game state: conferences and their themes and quests, attendees and their characters and maps, XP, parties, coins for speakers, the leaderboard, and the after-conference recap, report and speaker recognition. Owns `game-api` and the indexes `conquest-conferences`, `conquest-attendees`, `conquest-xp-events`, `conquest-parties`, `conquest-coins`. All state is in Elasticsearch, and the leaderboard and report are Elasticsearch aggregations over `conquest-xp-events` (part of the Elastic track story). Every XP award is a traced, measured event (part of the Dash0 story).

## Non-goals

- Failing. Nothing in Conquest takes XP away or can be lost; showing up always succeeds.
- Quizzes, timers, check-in location verification.
- Trading coins between attendees, buying things with coins.
- Editing or deleting XP events.

## Interface

The game-api routes and types in [000](000-overview.md#contracts). game-api calls search-api (`SEARCH_API_URL`) for `rank`, `suggest-goals` and talk lookups; in tests it uses a fake search client with the same interface.

## Behavior

### Conferences (organizer)

1. `POST /conferences` saves the conference and generates its `Theme` from `theme_prompt` with OpenAI (JSON output validated against the `Theme` zod schema). If the call fails, the output is invalid, or `fg` on `bg` is under 4.5:1 contrast, use the fallback theme ("Kube Caverns": bg `#14111f`, fg `#f4efe6`, accent `#f2a541`, boss `boss`, room `chamber`) with the organizer's prompt kept in `prompt`.
2. Every new conference gets three default organizer quests, editable with `PUT /quests`: "Meet five adventurers" (network, 5, 150 XP), "Defeat three bosses" (checkin, 3, 200 XP), "Capture the moment" (photo, 3, 75 XP). Sponsored quests are `kind: "sponsor"` with a `sponsor` name.
3. `rooms` default to every distinct room in the talks index (via search-api), all `step_free: true`; organizers can mark rooms not step-free with a note.

### Attendees (signup)

4. `POST /attendees/draft` suggests a class and goals without saving: goals from search-api `suggest-goals` with the about text; class from OpenAI given headline + about, falling back to keyword rules on headline + about (security/compliance → rogue, platform/infra/SRE/ops → knight, data/ML/AI/research → wizard, devrel/community/PM/design/anything else → bard). `avatar_seed` is a random 8-char string.
5. `POST /attendees` validates and normalizes `linkedin_url` (accepts `linkedin.com/in/<slug>` with or without `https://`, `www.`, a country subdomain, a trailing slash or query string; stores `https://www.linkedin.com/in/<slug>/`; anything else is `400 bad_linkedin_url`). It never requests the URL. `photo`, when given, must be a `data:image/jpeg;base64,` URL of at most 40 KB (`400 bad_photo`); it is stored with `index: false`. It saves the attendee with `xp 0`, `level 1`, `coins 3`, a unique 6-char uppercase `code` (no `0 O 1 I`), and `map` from search-api `rank(goals, about, 6)`. It adds one **goal quest** per goal that has a boss: "Defeat the <boss_noun> of <goal>" (checkin, 1, `talk_ids` = the bosses whose reason names that goal, 100 XP), plus the conference's quests.

Allies: `GET /attendees/:id` returns `allies`, everyone the attendee networked with (from their `network` events), with name, headline, LinkedIn link and photo, so they can connect on LinkedIn after the conference.

### XP

6. XP table (in one module, `src/xp/rules.ts`, and nowhere else):

   | Kind | Base XP | Limits |
   | --- | --- | --- |
   | `checkin` on a talk on your map (a boss) | 150 | once per talk |
   | `checkin` on any other talk | 100 | once per talk |
   | `photo` | 25 | at most 20 per attendee; `talk_id` optional |
   | `network` | 50 to **each** of the two attendees | once per pair, in either direction; not yourself |
   | `quest` | the quest's `xp` | once per quest, awarded automatically |

7. **Party bonus.** A `checkin` gets multiplier **1.25** when at least one other member of the attendee's party has already checked into the same talk; otherwise 1.0. `xp = round(base_xp * multiplier)`.
8. **Check-ins are allowed at any time** (the demo is not during the talk). The talk must exist in search.
9. `POST /xp` with `kind: "network"` takes `other_code`; it writes one event for each attendee. With `kind: "quest"` it is refused (`400 quest_auto`): quests complete on their own.
10. After any event, check the attendee's quests: a quest is complete when the count of the attendee's events of the target type (restricted to `talk_ids` if set; for `coin`, coin gifts) reaches `count`. Award a `quest` event once per completed quest.
11. A boss check-in also gives +1 coin.
12. `level = floor(sqrt(xp / 100)) + 1`.
13. Attendee `xp`, `level`, `coins` are kept on the attendee document for fast reads and updated with optimistic concurrency (`if_seq_no`/`if_primary_term`, retry up to 3 times). Events are written with `refresh: "wait_for"` so the leaderboard is current for the demo.

### Parties, coins

14. `POST /parties` creates a party with the creator as its only member; an attendee in a party can't create or join another. `join` adds a member; max 4 (`409 party_full`).
15. `POST /coins` gives one coin to the talk's **first speaker** (one coin per gift). Requires the attendee checked into that talk (`403 not_checked_in`) and `coins >= 1` (`409 no_coins`). Note is 0-280 chars. One gift per attendee per talk.

### Leaderboard, report, recognition, recap

16. **Leaderboard:** `terms` aggregation on `attendee_id` over `conquest-xp-events` for the conference, ordered by `sum(xp)` descending, top `limit` (default 10), joined with attendee name, class and level. Ties broken by earliest last event.
17. **Report:** from aggregations over `conquest-xp-events`: counts by kind, distinct attendees, connections (network events / 2), parties count, top 5 talks by check-ins, completions per quest, XP per hour (`date_histogram`).
18. **Speaker recognition:** coins and notes from `conquest-coins` for the speaker, newest first, with the giver's name.
19. **Recap:** stats from the attendee's events (bosses = boss check-ins, allies = distinct network partners, xp, level, coins given) and a LinkedIn post written by OpenAI from those stats and the boss talk titles, first person, under 1,000 characters, ending with `#KubeCon #Conquest`. Fallback: a fixed template filled with the same numbers and up to three boss titles. No personal note text from coins goes into the prompt.

### Telemetry

20. Every XP award is a span `xp.award` with `conquest.conference.id`, `conquest.xp.kind`, `conquest.xp.amount`, `conquest.party.size`; increments `conquest.xp.awarded{kind}` and, for check-ins, `conquest.checkins`. Leaderboard reads record `conquest.leaderboard.duration`. No names or notes in telemetry.

## Acceptance criteria

- **GM-1** Creating a conference with OpenAI unavailable gives the fallback theme and keeps the organizer's prompt.
- **GM-2** A generated theme whose `fg`/`bg` contrast is under 4.5:1 is replaced by the fallback theme.
- **GM-3** A new conference has the three default quests.
- **GM-4** Draft without OpenAI picks the class by the keyword rules (`"Staff SRE"` → knight, `"Security engineer"` → rogue, `"ML researcher"` → wizard, `"Developer advocate"` → bard).
- **GM-5** A new attendee has xp 0, level 1, coins 3, a 6-char code without `0 O 1 I`, a map from search `rank`, and one goal quest per goal that has a boss.
- **GM-19** `linkedin_url` variants (`linkedin.com/in/jane-doe`, `https://uk.linkedin.com/in/jane-doe/?trk=x`, `www.linkedin.com/in/jane-doe/`) all store `https://www.linkedin.com/in/jane-doe/`; a non-profile URL (`linkedin.com/company/x`, `example.com`) is `400 bad_linkedin_url`; no network request is made.
- **GM-20** A photo that isn't a JPEG data URL or is over 40 KB is `400 bad_photo`; a valid one is returned on the attendee and on leaderboard rows.
- **GM-21** After two attendees network, each one's `allies` contains the other with their LinkedIn link.
- **GM-6** Boss check-in gives 150 XP and +1 coin; non-boss check-in gives 100 XP; a second check-in to the same talk is refused (`409 already_checked_in`).
- **GM-7** A check-in gets multiplier 1.25 and `xp = round(base * 1.25)` when a party member already checked into that talk, else 1.0.
- **GM-8** Photo gives 25 XP and the 21st photo is refused (`409 photo_limit`).
- **GM-9** Network by code gives 50 XP to both attendees; repeating the pair either way is refused (`409 already_connected`); own code is refused (`400 self`).
- **GM-10** Reaching a quest's target awards its XP exactly once, and `talk_ids` restricts which check-ins count.
- **GM-11** `level` follows `floor(sqrt(xp/100)) + 1` (0 → 1, 100 → 2, 400 → 3, 900 → 4).
- **GM-12** Parties hold at most 4; joining a fifth is `409 party_full`; an attendee can't be in two parties.
- **GM-13** Giving a coin needs a check-in to the talk and a coin; it lowers coins by 1 and shows up in that speaker's recognition with the note.
- **GM-14** Leaderboard orders by summed XP from events, descending, and respects `limit`.
- **GM-15** Report counts match the events written (fixture of known events → known report).
- **GM-16** Recap without OpenAI uses the template, with correct stats and at most three boss titles.
- **GM-17** Concurrent XP awards to the same attendee don't lose updates (two parallel awards → both reflected in `xp`).
- **GM-18** Every XP award emits an `xp.award` span with the four attributes and no personal text (in-memory span exporter test).

## Open questions

- Should gifts go to every speaker of a multi-speaker talk? **Default:** first speaker only (Behavior 15).
- Should check-ins be limited to the talk's time window after the demo? **Default:** no time limit in the MVP.
