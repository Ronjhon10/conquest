# Overview

Status: picked at kickoff (2026-11-09). Built from the [kickoff transcript](../meeting-recordings/team/2026-11-09-1040-kickoff-ideation-transcript.md), its [summary](../meeting-recordings/team/2026-11-09-1040-kickoff-ideation-summary.md) and the [whiteboard](../meeting-recordings/team/2026-11-09-1040-kickoff-whiteboard.md). When this file and those disagree, this file is the current answer; change it here when we change our minds.

## The hackathon

- **Event:** _(name not recorded yet)_
- **Theme:** make conferences better
- **Tracks we're entering:** Elasticsearch (main) and Guitar (CI/CD checks, second). Dropped: Radar and Kubernetes (contrived for a conference). Dash0 is out unless there's time left (see open questions).
- **Deadline:** submit by 5:30 (2026-11-09)
- **Format:** probably a two-minute submitted video, not a live pitch
- **Judging criteria:** _(not written down yet)_. What we know about the judges: one wants "tech to serve the user, not show off"; another wants "a real user with a real problem" and is skeptical of AI added for its own sake. They're technical and want to see how the track tools are actually used.
- **Prizes we're going for:** Elasticsearch track, Guitar track

## The idea

**Conquest** ("conference quest"): **make conferences fun.**

- **Problem:** conferences are something you sit through. Attendees came for connections, opportunities and knowledge, but have no reason to go meet people, find the talks that matter to them, or share what they got out of it. Organizers and sponsors want visibility and candidates, and speakers want exposure and a following, and the conference gives them little of either.
- **Who has it:** three groups, all served by the same game.

  | Who | What they want | What Conquest gives them |
  | --- | --- | --- |
  | Attendees | Connections, opportunities, knowledge | A personal dungeon map of the talks that match their goals, quests, a party, XP, a recap post to share |
  | Organizers / sponsors | Visibility and exposure, candidates | A themed dungeon for their conference, their own and sponsored quests, a live leaderboard, an after-action report |
  | Speakers | Exposure, a following, to feel good about giving their time | Coins and thank-you notes from attendees, shown after the conference |

- **What we build:** a product organizers use to make a themed dungeon-crawler for their conference, and the attendee app that plays it.
  1. **Organizer sets up** the dungeon: theme (space, sky, teeth, anything), speaker bosses, their own quests and sponsored quests. The dungeon structure is always a dungeon crawler; the theme is what changes.
  2. **Attendee signs up** a few days before, all taps: character auto-made from LinkedIn (editable), goals offered as suggestions from LinkedIn (or typed). Elasticsearch ranks the talks against those goals, and the top talks become the bosses on **their** dungeon map. They see the map and their quests right away, to build hype.
  3. **At the conference**, attendees earn XP: check into a talk (fight the boss), take a photo, network (scan each other's code), finish quests. Fighting a boss with a party (knight, wizard, ...) gives about 1.25x XP. Showing up always succeeds; there's no failing and no quizzes. A leaderboard runs on the monitors.
  4. **After the conference:** attendees get a generated recap image and LinkedIn post (they pick the photos), talk summaries and suggested follow-ups. Organizers get an after-action report. Speakers see the coins and notes they were given.

- **How the tracks fit:**
  - **Elasticsearch:** talks, speakers and booths are indexed as documents. Keyword plus semantic search over an attendee's goals and LinkedIn interests ranks the talks that become their bosses, and backs the free-typed "what do you want out of this conference" step.
  - **Guitar:** runs CI checks behind the scenes on the code generated for each organizer's custom dungeon, with checks set up per conference. Organizers never see it.

- **Why it wins:** it's a real problem every judge has sat through, aimed at real people (attendees, organizers, speakers), and the track tech does real work (search picks your talks; CI keeps generated dungeons from breaking) rather than being bolted on. And it's fun to watch in a two-minute video. Even if you lose the hackathon, you could win the dungeon.

## The demo in one sentence

An organizer themes a dungeon, an attendee signs up with LinkedIn and gets a map of bosses picked by Elasticsearch, plays the conference for XP alongside real-life footage, and walks away with a recap post while the speaker sees their coins.

### Demo flow (two minutes)

0. **Slide:** the problem. Attendees, organizers and speakers; make conferences fun.
1. **Organizer** (slide): sets up and customizes the dungeon and speaker bosses.
2. **Attendee, before the conference** (live): sign up, LinkedIn, character, goals (pre-filled), then the map and quests.
3. **At the conference** (live, the key part): every way to earn XP, split screen with real-life footage next to the phone. Organizer sees the leaderboard.
4. **After:** attendee recap post, organizer after-action report, speaker recognition.
5. **Slides:** how Elasticsearch and Guitar work behind the scenes. Also name Elasticsearch during the walkthrough.

Shown with one real theme, plus screenshots of others (beauty conference, dental conference).

## Out of scope for the hackathon

- Any theme engine beyond a dungeon crawler
- Anti-cheating on the leaderboard (gaming it is fine for the MVP)
- Emailing the map before the conference
- Tracking whether follow-ups happen

## Open questions

- Second track is Guitar or Sonar? The board says "Elastic Search + Sonar", the conversation says Guitar. **Default until answered:** Guitar.
- Dash0 in or out? **Default:** out. Revisit only if there's time for an organizer live-stats view.
- How do coins work: do you start with some, or earn them from bosses and quests? **Default:** every attendee starts with a few coins and earns more from bosses.
- How does the participation reward stay meaningful without a failure state? **Default:** check-in gives base XP; photos, party fights and quests are where the bonus is.
- Is the avatar badge sticker (scanned like a QR code) in the MVP? **Default:** a QR code on the phone in the app; the sticker is a slide.
- Do XP for helping with accessibility and giving swag to speakers (on the board) count? **Default:** not for the MVP.
- Crowd heat map for organizers? **Default:** no.
- Event name and judging criteria. **Default:** fill in when someone checks the event page.

## Ideas we considered

| Idea | Why not (or not yet) |
| --- | --- |
| Radar / Kubernetes as the dungeon | Contrived for a conference |
| Dash0 tracking every XP event as OpenTelemetry traces for the organizer dashboard | Observability tooling, hard to fit; left out at the end of kickoff |
| Speaker ranking by coins | Changed to coins as "giving respect", not a ranking |
| Quizzes after talks | Feels like homework; Conquest has no failing |
