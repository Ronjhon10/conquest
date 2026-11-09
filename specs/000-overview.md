# 000: Overview

Status: Accepted
Prefix: `OV`

## Purpose

Conquest makes conferences fun. An organizer themes a dungeon for their conference; each attendee gets a personal dungeon map whose bosses are the talks Elasticsearch picked for their goals; they earn XP by checking into talks, taking photos, networking and finishing quests, alone or in a party; afterwards attendees get a recap post, organizers an after-action report, speakers the coins and notes they were given. The product idea is in [idea/overview.md](../idea/overview.md). This spec is the architecture, the contracts between lanes, and the demo path. **Read it before any other spec.**

Every sponsor track is used for real:

| Track | Where it lives | Spec |
| --- | --- | --- |
| Elasticsearch | The only database. Hybrid search ranks talks into bosses; aggregations make the leaderboard and reports | [020](020-search.md), [030](030-game.md) |
| Kubernetes + Radar | All services run on the event's cluster; Radar connected for UI, MCP and AI investigations | [010](010-platform.md) |
| Dash0 | OpenTelemetry traces, metrics, logs from every service plus browser RUM; organizer live dashboard + SLO | [010](010-platform.md), conventions below |
| Sonar / Gitar | Every PR reviewed by Gitar with our repo rules; CI failures diagnosed and auto-fixed | [010](010-platform.md) |
| Merge Forward | Accessible map (list view, step-free routes), alt text rule | [040](040-web.md) |

## Architecture

```
                 ┌──────────────── Kubernetes (event cluster, namespace conquest) ────────────────┐
 browser ──HTTPS─▶ ingress ─┬─ /              ─▶ web         (Next.js, attendee + organizer + speaker UI)
 (OTel RUM)        │        ├─ /api/search/*  ─▶ search-api  (Hono, Node 22)  ──┐
                   │        └─ /api/game/*    ─▶ game-api    (Hono, Node 22)  ──┤──▶ elasticsearch (ECK, single node)
                   │                                game-api ──HTTP──▶ search-api (rank)
                   │        all three ──OTLP──▶ otel-collector ──OTLP──▶ Dash0
                   │        Radar connected to the cluster (UI + MCP)
                   └────────────────────────────────────────────────────────────────────────────────┘
 GitHub: lane branch ─PR─▶ CI (lint, typecheck, test) + Gitar review/auto-fix ─merge─▶ main ─▶ image build ─▶ deploy
 OpenAI (event credits): dungeon theme, character + goal suggestions, recap post, embeddings for semantic search
```

- The browser only talks to the ingress. `web` calls the APIs from the browser with relative URLs (`/api/search/...`, `/api/game/...`).
- `game-api` is the only writer of game state. `search-api` owns the talk and speaker indexes and ranking.
- Elasticsearch is the only datastore. No Postgres, no Redis, no files on disk.

## Repo layout

npm workspaces, TypeScript everywhere, vitest for tests, Node 22.

```
apps/web/                 Next.js (App Router)            lane: Web
services/search-api/      Hono                             lane: Search
services/game-api/        Hono                             lane: Game
packages/contracts/       shared TS types + zod schemas    owned by this spec; changes need a PR touching 000
packages/telemetry/       OTel setup helper for services   lane: Platform
scripts/seed/             KubeCon schedule -> NDJSON       lane: Search
data/kubecon-na-2026.ndjson  seed talks + speakers         lane: Search
deploy/k8s/               kustomize manifests              lane: Platform
.github/workflows/        CI, image build, deploy          lane: Platform
```

## Lanes

Four lanes, built in parallel. Each lane owns its folders, works on `<name>/<lane>-<thing>` branches, and builds against the **contracts below**, faking other lanes until they land (a fixture or an in-memory fake behind the same interface). Nobody edits another lane's folder without telling its owner.

| Lane | Owns | Specs | Owner |
| --- | --- | --- | --- |
| Platform | cluster, deploy, Elasticsearch install, OTel collector, Dash0, Radar, CI, Gitar, `packages/telemetry` | 010 | |
| Search | indexes `talks`, `speakers`; seed data; `search-api` | 020 | |
| Game | indexes `conferences`, `attendees`, `xp-events`, `parties`, `coins`; `game-api` | 030 | |
| Web | `apps/web`, accessibility | 040 | |

Order of first steps so nobody waits: step 0.1 in `product/BUILD.md` (workspace + contracts) is done first by anyone, ~20 minutes. After that, all four lanes start together.

## Contracts

These live in `packages/contracts` as TypeScript types with zod schemas of the same names. Times are ISO 8601 strings in UTC. IDs are strings.

```ts
// ---- Search lane owns these documents ----
type Talk = {
  id: string; title: string; abstract: string;
  speaker_ids: string[];
  room: string; starts_at: string; ends_at: string;
  track: string | null;          // conference's own track/category
  level: string | null;          // e.g. "Beginner"
  tags: string[];
};
type Speaker = { id: string; name: string; company: string | null; bio: string; photo_url: string | null };

type BossSlot = { talk_id: string; score: number; reason: string };   // reason: short human text, e.g. matched goal

// ---- Game lane owns these documents ----
type Theme = {
  name: string;                  // e.g. "Kube Caverns"
  prompt: string;                // what the organizer typed
  palette: { bg: string; fg: string; accent: string };  // hex; must pass WCAG AA (fg on bg >= 4.5:1)
  boss_noun: string;             // "boss", "kraken", ...
  room_noun: string;             // "chamber", "deck", ...
  intro: string;                 // one-paragraph story shown on the map
};
type QuestTarget = { type: "checkin" | "photo" | "network" | "coin"; count: number; talk_ids: string[] | null };  // talk_ids: only these talks count
type Quest = {
  id: string; title: string; description: string; xp: number;
  kind: "organizer" | "sponsor" | "goal"; sponsor: string | null;
  target: QuestTarget;
};
type Room = { name: string; step_free: boolean; step_free_note: string | null };
type Conference = { id: string; name: string; theme: Theme; quests: Quest[]; rooms: Room[]; created_at: string };

type CharacterClass = "knight" | "wizard" | "rogue" | "bard";
type Attendee = {
  id: string; conference_id: string;
  name: string; headline: string; linkedin_url: string | null;
  class: CharacterClass; avatar_seed: string;
  goals: string[];
  code: string;                  // 6-char code shown as QR for networking
  party_id: string | null;
  xp: number; level: number; coins: number;
  map: BossSlot[];               // ordered, 5-8 bosses
  quests: Quest[];               // goal quests made for this attendee + the conference's quests
  created_at: string;
};
type XpKind = "checkin" | "photo" | "network" | "quest";
type XpEvent = {
  id: string; conference_id: string; attendee_id: string;
  kind: XpKind;
  talk_id: string | null; other_attendee_id: string | null; quest_id: string | null; party_id: string | null;
  base_xp: number; multiplier: number; xp: number;
  at: string;
};
type Party = { id: string; conference_id: string; name: string; member_ids: string[] };   // max 4
type CoinGift = { id: string; conference_id: string; from_attendee_id: string; speaker_id: string; talk_id: string; note: string; at: string };
type LeaderboardRow = { attendee_id: string; name: string; class: CharacterClass; xp: number; level: number };
type Recap = { post_text: string; stats: { bosses: number; allies: number; xp: number; level: number; coins_given: number } };
type Report = {
  attendees: number; checkins: number; photos: number; connections: number; parties: number;
  top_talks: { talk_id: string; checkins: number }[];
  quest_completion: { quest_id: string; completed: number }[];
  xp_by_hour: { hour: string; xp: number }[];
};
type SpeakerRecognition = { speaker_id: string; coins: number; notes: { from_name: string; note: string; talk_id: string; at: string }[] };
```

### HTTP API

All JSON. Errors are `{ "error": { "code": string, "message": string } }` with a 4xx/5xx status. Each service also serves `GET /healthz` → `200 {"ok":true}`.

**search-api** (`/api/search`)

| Method + path | Body / query | Returns |
| --- | --- | --- |
| `GET /api/search/talks` | `?q=&limit=20` | `{ results: { talk: Talk; score: number; highlight: string \| null }[] }` |
| `GET /api/search/talks/:id` | | `{ talk: Talk; speakers: Speaker[] }` |
| `POST /api/search/rank` | `{ goals: string[]; about: string; limit?: number }` | `{ bosses: BossSlot[] }` |
| `POST /api/search/suggest-goals` | `{ about: string }` | `{ goals: string[] }` (3-6 short phrases) |
| `GET /api/search/speakers/:id` | | `{ speaker: Speaker; talks: Talk[] }` |

**game-api** (`/api/game`)

| Method + path | Body | Returns |
| --- | --- | --- |
| `POST /api/game/conferences` | `{ name; theme_prompt; rooms?: Room[] }` | `{ conference: Conference }` |
| `GET /api/game/conferences/:id` | | `{ conference: Conference }` |
| `PUT /api/game/conferences/:id/quests` | `{ quests: Omit<Quest,"id">[] }` | `{ conference: Conference }` |
| `PUT /api/game/conferences/:id/rooms` | `{ rooms: Room[] }` | `{ conference: Conference }` |
| `POST /api/game/attendees/draft` | `{ conference_id; name; headline; about; linkedin_url? }` | `{ class; avatar_seed; suggested_goals: string[] }` (nothing saved) |
| `POST /api/game/attendees` | `{ conference_id; name; headline; about; linkedin_url?; class; avatar_seed; goals }` | `{ attendee: Attendee }` (map built via search-api `rank`) |
| `GET /api/game/attendees/:id` | | `{ attendee: Attendee; party: Party \| null }` |
| `POST /api/game/xp` | `{ attendee_id; kind; talk_id?; other_code?; quest_id? }` | `{ event: XpEvent; attendee: Attendee }` |
| `POST /api/game/parties` | `{ attendee_id; name }` | `{ party: Party }` |
| `POST /api/game/parties/:id/join` | `{ attendee_id }` | `{ party: Party }` |
| `POST /api/game/coins` | `{ from_attendee_id; talk_id; note }` | `{ gift: CoinGift; attendee: Attendee }` |
| `GET /api/game/conferences/:id/leaderboard` | `?limit=10` | `{ rows: LeaderboardRow[] }` |
| `GET /api/game/conferences/:id/report` | | `{ report: Report }` |
| `GET /api/game/speakers/:id/recognition` | | `{ recognition: SpeakerRecognition }` |
| `POST /api/game/attendees/:id/recap` | | `{ recap: Recap }` |

No auth in the MVP: the attendee id lives in the browser's localStorage. The organizer view is `/organizer/:conference_id`. See non-goals.

### Elasticsearch indexes

One cluster, index names prefixed `conquest-`: `conquest-talks`, `conquest-speakers` (Search lane), `conquest-conferences`, `conquest-attendees`, `conquest-xp-events`, `conquest-parties`, `conquest-coins` (Game lane). Each owner creates its indexes and mappings on service start if missing (idempotent). Services read `ELASTICSEARCH_URL` and `ELASTICSEARCH_API_KEY` from the environment.

### Telemetry conventions (every lane)

- Service names: `conquest-web`, `conquest-search-api`, `conquest-game-api`. Resource attribute `deployment.environment` = `dev` | `demo`.
- Services call `startTelemetry(serviceName)` from `packages/telemetry` first thing; it sets up traces, metrics and logs over OTLP to `OTEL_EXPORTER_OTLP_ENDPOINT` (the collector). Auto-instrument HTTP and the Elasticsearch client.
- Custom attributes use the `conquest.` prefix: `conquest.conference.id`, `conquest.xp.kind`, `conquest.xp.amount`, `conquest.party.size`, `conquest.search.goals_count`. **Never put names, LinkedIn text, notes or other personal text in telemetry.** IDs are fine.
- Metrics: `conquest.xp.awarded` (counter, attrs kind), `conquest.checkins` (counter), `conquest.search.rank.duration` (histogram, ms), `conquest.leaderboard.duration` (histogram, ms).
- Logs are JSON to stdout with `trace_id` and `span_id`.

### Environment and secrets

Real values are never committed. Locally they live in `.env` (gitignored); on the cluster in a Secret `conquest-secrets` created by a human. `.env.example` lists every name: `ELASTICSEARCH_URL`, `ELASTICSEARCH_API_KEY`, `OPENAI_API_KEY`, `SEARCH_API_URL` (game-api → search-api), `OTEL_EXPORTER_OTLP_ENDPOINT`, `DASH0_AUTH_TOKEN` (collector only), `DASH0_ENDPOINT`, `NEXT_PUBLIC_DASH0_RUM_*` (web).

### OpenAI use

Model and key come from env (`OPENAI_API_KEY`, `OPENAI_MODEL`, default `gpt-4.1-mini`). Every OpenAI call has a **deterministic fallback** so the demo never dies on an API error and tests never call OpenAI: a default theme, class picked by keyword rules, a template recap. Calls are traced (span `openai.<purpose>`), never logging prompts that contain personal text.

## The demo path

The two-minute video follows this. Everything we build serves it first.

1. Slide: the problem.
2. Organizer creates "KubeCon NA 2026", types a theme prompt, gets a generated theme; edits a quest; marks a room not step-free. (040 organizer screens, 030 conferences)
3. Attendee signs up: pastes LinkedIn headline and about, gets a class and suggested goals, picks goals, sees **their map of real KubeCon talks as bosses** with the reason each was picked, and their quests. (020 rank, 030 attendees, 040)
4. At the conference, split screen with real-life footage: check into a boss talk with a party (1.25x shown), take a photo, scan a friend's code, finish a quest, give a speaker a coin. The leaderboard on the "monitor" updates. (030 xp, 040)
5. After: attendee recap post, organizer report, speaker recognition. (030, 040)
6. Slides: Elasticsearch hybrid ranking, the cluster in Radar with a real AI investigation, the Dash0 dashboard/SLO with a real Agent0 finding, a Gitar review and auto-fix on one of our PRs, accessibility.

## Non-goals

- Accounts, login, LinkedIn OAuth or scraping LinkedIn. Attendees paste their own headline and about text.
- Storing photos. Taking a photo awards XP; the photo stays on the device.
- Anti-cheat on XP or the leaderboard.
- More than one game type. It's always a dungeon crawler; only the theme changes.
- Emails, push notifications, native apps.
- Multi-region, autoscaling, backups.

## Acceptance criteria

- **OV-1** The demo path above runs end to end on the deployed URL on the event cluster.
- **OV-2** `packages/contracts` exports every type and zod schema above, and `npm run typecheck` passes across the workspace.
- **OV-3** Every service answers `GET /healthz` with `200 {"ok":true}`.
- **OV-4** Every API error body matches `{ error: { code, message } }`.
- **OV-5** Every OpenAI-backed feature works with `OPENAI_API_KEY` unset, using its fallback.
- **OV-6** No test calls OpenAI, Dash0 or a remote Elasticsearch; unit tests use fakes, and integration tests needing Elasticsearch run only when `ES_INTEGRATION=1` against a local container.

## Open questions

- Does the event hand out a cluster per team, and does it have room for Elasticsearch (2 GiB)? **Default until answered:** yes; if not, Platform creates a small cloud cluster (a human creates it with their card) and the specs don't change.
- Is RRF (reciprocal rank fusion) available on the Elasticsearch license we get? **Default:** try the `rrf` retriever; if refused, combine BM25 and semantic in one `bool.should` query (020 says how).
- Video or live presentation? **Default:** record the two-minute video by 5:15; be ready to demo live too.
