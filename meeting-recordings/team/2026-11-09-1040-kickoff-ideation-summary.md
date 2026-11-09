# Kickoff ideation: summary

Transcript: [2026-11-09-1040-kickoff-ideation-transcript.md](2026-11-09-1040-kickoff-ideation-transcript.md)
Whiteboard: [photo](2026-11-09-1040-kickoff-whiteboard.jpg) and [transcribed text](2026-11-09-1040-kickoff-whiteboard.md)

Team brainstorm at the hackathon kickoff. The first half widens the idea (organizers, speakers, party mechanics, sponsor tools) and the second half boils it down to a two-minute demo flow. The date is the day it was pushed. Speaker labels in the transcript are unreliable, so nothing below is attributed to a person.

## Decisions

- **Name: Conquest** ("conference quest"). Repo is `conquest`.
- **Core value:** make conferences fun, so attendees want to share the experience. The hackathon's own goal is "make conferences better".
- **Tracks:** Elasticsearch is the main one. Guitar (CI/CD checks) is the second. Radar and Kubernetes were dropped as contrived for a conference. Dash0 was talked about for the XP and organizer dashboard, then left out ("I don't think so") because it is observability tooling that's hard to fit here.
- **Elasticsearch use:** index talks, speakers and booths as documents. At signup, an attendee's stated goals plus LinkedIn interests drive keyword + semantic search that ranks talks. The top results become the bosses on their personal dungeon map. The same search backs the "what do you want out of this conference" step.
- **Guitar use:** runs behind the scenes on the code generated for each organizer's customized dungeon, with checks set up per conference. Organizers don't see it. Idea floated: each conference gets its own repo.
- **Product shape:** a product organizers use to build a themed dungeon for their conference. For MVP it is always a dungeon crawler (space, sky or teeth-themed is fine). Our wrapper stays our style, and the dungeon core is customizable.
- **Not a failure game.** Showing up always succeeds (participation reward). Photos and other challenges are bonus XP on top. No homework-style quizzes.
- **Parties:** attendees form a party (knight, wizard and so on). Fighting a boss with a party gives bonus XP (about 1.25x). Networking makes allies. Party setup happens when you're at the conference, after you've seen the map.
- **Ways to gain XP:** check into a talk, take a photo, network (scan each other's badge or a code on a phone), meet organizer or sponsor quests.
- **Quests:** personalized from the goals the attendee entered (more XP for what they said they want). Organizers can set their own quests (meet five people, talk to three vendors), and sponsored quests can enter you into a prize draw.
- **Coins for speakers:** attendees give speakers coins as thanks, framed as "giving respect" rather than a ranking. The speaker sees who gave it and a note. This is a post-conference view for speakers.
- **Leaderboard:** most XP and highest level at the conference, shown on monitors and visible to organizers. It's also a reason to connect with people. Gaming it is fine for the MVP.
- **Signup flow:** very tap-through. The character is auto-made from LinkedIn and editable. Goals come as suggested options based on LinkedIn, with free typing handled by Elasticsearch. Signup happens a few days before. The map is shown right at signup (in-app) to build hype. An email with the map was considered but is probably extra fluff.
- **Post-conference:** attendees get a generated recap graphic and LinkedIn post they can pick photos for, plus a talk summary and AI-suggested follow-ups (no tracking). Organizers get an after-action report with stats and what's next. Speakers get their coins and notes.
- **Demo format:** a two-minute submission video (likely submitted, not presented live), mixing slides and a real app walkthrough. The walkthrough uses one real theme and screenshots of others (beauty, dental and so on).

## Demo flow (as agreed)

1. **Slide 1:** the problem. "Attendees, organizers and speakers, and make conferences fun."
2. **Organizer:** sets up and customizes the dungeon (one slide).
3. **Attendee signup:** character from LinkedIn, goals, then the map and quests.
4. **At the conference (the key part):** show every way to earn XP, with an automated script. Split screen with AI-generated (or past) photos of real people doing the thing next to the phone screen: check into a talk, take a photo, network, party fight.
5. **Post-conference:** attendee, organizer and speaker views.
6. **Slides at the end:** two technical slides on how it works behind the scenes with Elasticsearch and Guitar. The judges are technical and asked for this.

## Open questions

- Do the technical slides go at the end, or is it better to mention Elasticsearch during the walkthrough as well? (Leaning: both.)
- Does Dash0 get dropped for good? (Leaning: yes, unless there's time for an organizer live-stats view.)
- How do coins work in the economy: do you start with some, and earn them from conferences and bosses?
- How does the "participation" reward stay meaningful if there's no failure state?
- Whether the badge-scan idea (a sticker with your avatar that's scanned like a QR code) goes into the MVP or just a slide.
- Do judges care about the "simple, real user, real problem" angle? The LinkedIn notes on judges suggest yes.
- Crowd heat map for organizers was floated near the end with no discussion.
- Second track: the whiteboard's tech step says "Elastic Search + Sonar", but the transcript discusses Guitar (CI/CD checks). Which one is it, or is "Guitar" a transcription error?
- The whiteboard also lists XP for helping with accessibility and giving coins or swag to speakers, and still has "Radar/Kubernetes is Dungeon" in red. Are these in or out?

## Action items

- ~~Make the repo and put the whiteboard photos of this flow into it (they said "take pictures of this all").~~ Done: [whiteboard photo and text](2026-11-09-1040-kickoff-whiteboard.md). Add any other photos the same way.
- Turn this into a spec in `specs/` with numbered criteria, and add build steps to `product/BUILD.md`.
- Fill in `idea/overview.md` (event, tracks, deadline, judging criteria). The submission deadline was mentioned as 5:30.
- Look into what Dash0 does and decide whether to use it (someone said they'd read up on it).
- Collect each member's GitHub username and add them to the repo (this was being sorted out at the end).
- Upload this transcript to the repo (this file).

## Spec changes implied

- The product is two surfaces: organizer (theme and quests) and attendee, with a speaker post-conference view.
- Elasticsearch ranking of talks from stated goals and LinkedIn interests, feeding the personal map.
- XP events with a party multiplier (about 1.25x).
- Coin gifting from attendee to speaker with a note, post-conference only.
- Per-conference themed dungeon with a fixed dungeon-crawler structure.
