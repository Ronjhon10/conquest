# Build

The checklist, split into four lanes that run at the same time. Each step names the spec and criteria it builds. Lanes: **Platform = Jake Nef, Search = Max, Game = Jacob Bingham, Web = Danny.** Take the first unticked step **in your lane**, put your name on it, build it on your own branch (`<name>/<lane>-<thing>`), open a PR, let Gitar and CI pass, merge, tick it. Specs: [000](../specs/000-overview.md) (read first), [010](../specs/010-platform.md), [020](../specs/020-search.md), [030](../specs/030-game.md), [040](../specs/040-web.md).

## Rules

1. One step at a time, in your lane's folders only (000 Lanes). Read every spec the step names.
2. Build against the contracts in `packages/contracts`. If another lane isn't ready, use its fake; never wait.
3. Tests are named by criterion ID (`it("GM-6 boss check-in gives 150 XP")`).
4. Done = tests, lint and typecheck pass, PR merged through Gitar + CI, box ticked, log line added below.
5. Ambiguity goes in `DECISIONS.md` (simplest reading), then keep going. A contract change is a PR that edits both `packages/contracts` and `specs/000-overview.md`, and tells the other lanes.
6. Agents never deploy, never create cloud resources, never handle real secrets. Humans do those steps (marked **human**).

## Timeline (MT, 2026-11-09)

| By | Milestone |
| --- | --- |
| 12:15 | 0.1 merged; every lane started |
| 1:30 | Each service answers with fakes; cluster up with Elasticsearch, collector, Radar; Gitar on |
| 3:00 | Integrated on the cluster: signup → map → check-in → leaderboard works on the public URL |
| 3:30 | Real issue investigated with Radar and Dash0 (or load test run, 010 Behavior 6) |
| 4:30 | Feature freeze. Only fixes after this |
| 5:00 | Video recorded (demo/script.md) |
| 5:30 | Submitted |

## Step 0 (anyone, first)

- [x] **0.1** npm workspace (`apps/*`, `services/*`, `packages/*`, `scripts/*`), root `tsconfig.base.json`, eslint, vitest, `.env.example`, and `packages/contracts` with every type and zod schema from 000. Empty Hono apps for both services with `/healthz` and the 000 error helper; empty Next app. (OV-2, OV-3, OV-4) owner: Max

## Lane: Platform (010)

- [x] **P.1** CI workflow (lint, typecheck, test) and `main` ruleset (PR + green `ci`; deploys go to branch `deploy`). (PL-4) owner: Max
- [x] **P.2** Gitar: config committed (`.gitar/`); trial started and app installed on Ronjhon10/conquest (2026-11-09); turn on auto-apply per PR with `gitar auto-apply:on`. (PL-9) owner: Jake Nef
- [x] **P.3** `packages/telemetry` with `startTelemetry`. (PL-1, PL-2) owner: Jake Nef
- [ ] **P.4** `docker-compose.yml` for the three apps (Dockerfiles, manifests, Argo CD app and deploy workflow are done). (PL-3) owner: Jake Nef
- [ ] **P.5** **Human:** Radar cluster (join.cnh.radarhq.io), `./deploy/setup-team.sh <team>` PR, everyone connects Radar MCP, Checks "before" screenshot. (PL-8) owner: Jake Nef
- [ ] **P.6** **Human:** Elastic Serverless project, Dash0 account and tokens, Secret `conquest-secrets`. Then the agent `get-started` skill applies `argocd/application.yaml`; first GitOps deploy verified on the URL. Seed Job. (PL-5) owner: Jake Nef
- [ ] **P.7** Dash0: verify traces/RUM/logs arrive; "Conquest live" dashboard + XP SLO; Dash0 MCP/Agent0 connected. (PL-6, PL-7) owner: Jake Nef
- [ ] **P.8** Load script `scripts/load/`; evidence folder filled as things happen. (PL-10) owner: Jake Nef

- [x] **P.R1** Include public web assets in the standalone image and verify bundled fonts in the production-container CI smoke test. (PL-5, WEB-1) owner: Jake Nef

## Lane: Search (020)

- [x] **S.1** Scrape KubeCon NA 2026 schedule → `data/kubecon-na-2026.ndjson` (talks + speakers). (SR-1) owner: Max
- [x] **S.2** Index mappings, idempotent seed. (SR-2) owner: Max
- [x] **S.3** `GET /talks` hybrid search with highlight and fuzziness; `GET /talks/:id`, `GET /speakers/:id`. (SR-3, SR-4, SR-11, SR-12) owner: Max
- [x] **S.4** Embeddings inference endpoint + `semantic_text`; RRF with fallback. (SR-5) owner: Max
- [x] **S.5** `POST /rank`: per-goal search, fusion, clash-free pick, reasons, time order. (SR-6..SR-9) owner: Max
- [x] **S.6** `POST /suggest-goals` from aggregations. (SR-10) owner: Max
- [x] **S.7** Telemetry spans/metrics per 020 Behavior 6. owner: Max

- [x] **S.R1** Complete room-discovery contract and Game conference integration, independent of talk-search limits. (OV-2, GM-3) owner: Jake Nef

## Lane: Game (030)

- [x] **G.1** Index setup, Elasticsearch repository layer, fake search client. owner: Jacob Bingham
- [x] **G.2** Conferences: create with theme (OpenAI + fallback + contrast check), default quests, rooms, quests/rooms PUT. (GM-1..GM-3) owner: Jacob Bingham
- [x] **G.3** Attendees: draft (class + goals) and create (LinkedIn URL normalize, profile photo, code, map via rank, goal quests), allies. (GM-4, GM-5, GM-19..GM-21) owner: Jacob Bingham
- [x] **G.4** XP rules module and `POST /xp` for checkin, photo, network; coins on boss check-in; levels; optimistic concurrency. (GM-6..GM-9, GM-11, GM-17) owner: Jacob Bingham
- [x] **G.5** Parties and the 1.25x bonus. (GM-7, GM-12) owner: Jacob Bingham
- [x] **G.6** Quest completion. (GM-10) owner: Jacob Bingham
- [x] **G.7** Coins and speaker recognition. (GM-13) owner: Jacob Bingham
- [x] **G.8** Leaderboard and report aggregations. (GM-14, GM-15) owner: Jacob Bingham
- [x] **G.9** Recap (OpenAI + template). (GM-16) owner: Jacob Bingham
- [x] **G.10** `xp.award` telemetry. (GM-18) owner: Jacob Bingham

- [x] **G.R1** Review fixes: atomic XP totals/outbox, concurrent action limits, quest deduplication and exclusive party membership. (GM-6, GM-8..GM-10, GM-12, GM-14, GM-17) owner: Jake Nef

## Lane: Web (040)

- [x] **W.1** App shell, theme CSS variables, typed API client with `NEXT_PUBLIC_FAKE_API` fakes and fixtures. (WEB-1, WEB-12, WEB-14) owner: Danny
- [x] **W.2** Attendee signup flow with LinkedIn link and profile photo. (WEB-2, WEB-15, WEB-16) owner: Danny
- [x] **W.2b** Optional LinkedIn OpenID Connect profile import, credential setup and recovery. (WEB-21..WEB-23) owner: Danny
- [ ] **W.2c** **Human activation:** enable the LinkedIn developer app's OpenID Connect product, add client ID/secret to the Web runtime settings, then verify a real consent round trip. Setup: `apps/web/LINKEDIN_SETUP.md`. owner: Danny
- [x] **W.3** Dungeon map: visual path + list view + step-free toggle. (WEB-3..WEB-5) owner: Danny
- [ ] **W.4** Boss page (check in, photo, coin), connect page (QR + typed code + allies), party page, XP feedback. (WEB-6, WEB-11, WEB-17) owner: Danny
- [ ] **W.5** Organizer: new, setup (theme, quests, rooms), live leaderboard, report. (WEB-7, WEB-13) owner: Danny
- [ ] **W.5a** Organizer theme studio: description → preview → revise/apply, themed map scenery and optional background within Conquest's consistent style. Coordinate theme preview/update and presentation contracts with Game before integration. (WEB-18..WEB-20) owner: Danny
- [ ] **W.6** Recap page and speaker page. (WEB-8) owner: Danny
- [ ] **W.7** RUM + traceparent. owner: Danny
- [ ] **W.8** Accessibility tests: axe + keyboard-only Playwright flows. (WEB-9, WEB-10) owner: Danny

## Integration and demo (everyone, from 3:00)

- [ ] **I.1** Turn off fakes on the cluster; run the 000 demo path on the public URL. (OV-1) owner:
- [ ] **I.2** `demo/script.md` (two minutes, timed) and the tech slides with evidence from `demo/evidence/`. owner:
- [ ] **I.3** Record the video; submit. owner:

## Log

<!-- YYYY-MM-DD HH:MM  step  who  what -->
- 2026-11-09 14:19  W.2b integration  Danny (Codex)  Merged newest main (map room art and updated Game/signup rules). LinkedIn link is now optional in Web, matching Game; authenticated profile import can proceed without a pasted URL. Full suite 278 passed/3 skipped; Web typecheck, lint and production build pass. Activation remains W.2c.
- 2026-11-09 14:15  W.2b  Danny (Codex)  Optional LinkedIn OpenID Connect sign-in for name/photo import; encrypted expiring cookies, state/nonce and signed-token validation, bounded CDN-only photo import into the existing JPEG contract, signup draft recovery, and manual fallback. 25 focused checks; full suite 250 passed/3 skipped, lint/typecheck/production build pass. Local signup/recovery routes return 200; browser host unavailable. Developer-app credentials/product activation and real consent verification remain W.2c. Prepared ignored local settings; no deployment changes or deploy.
- 2026-11-09 11:40  0.1  Max (Claude)  Workspace, packages/contracts (schemas, route bodies, INDEX names, fixtures), search-api + game-api skeletons with 501 stubs per route, Next app shell. 12 tests green; typecheck, lint, next build pass.
- 2026-11-09 12:10  P.1 + tooling  Max (Claude)  CI, main ruleset, Gitar review conventions + 5 rules, Radar cnh-starter layout (deploy/, argocd/, build-and-deploy, skills), specs 000/010 aligned with research.
- 2026-11-09 12:40  P.2  Max  Gitar Pro trial started, GitHub App installed on Ronjhon10/conquest. First Gitar-reviewed PR is the one that ticked this box.
- 2026-11-09 12:40  G.1  Jacob (Claude)  game-api storage: strict mappings for the 5 Game indexes + idempotent ensureIndexes on start; DocStore seam (Elasticsearch with refresh wait_for and if_seq_no/if_primary_term; in-memory for tests); typed repos validated with contracts schemas, update() retries version conflicts up to 3 times; SearchClient (HTTP + fixture fake); /readyz checks Elasticsearch.
- 2026-11-09 12:50  S.1  Max (Claude)  scripts/seed scraper (one GET of the LF schedule page, embedded Sessionize JSON) -> data/kubecon-na-2026.ndjson: 480 real talks, 703 speakers. SR-1 tests on the transform and the committed file.
- 2026-11-09 13:20  G.2-G.10  Jacob (Claude + Sonnet agents in parallel)  All game-api routes built against fakes: conferences + theme fallback/contrast, attendees (LinkedIn normalize, photo, code, map, goal quests, allies), POST /xp with rules module, parties + 1.25x, quest completion (incl. coin quests), coins + recognition, leaderboard/report as ES aggregations (memory twin for tests), recap with template fallback, xp.award span + metrics. 116 tests green; demo path smoke-tested in memory. Not yet run against real Elasticsearch.
- 2026-11-09 12:55  S.2  Max (Claude)  search-api EsPort (client adapter + in-memory fake), conquest-talks/conquest-speakers mappings (semantic field only when embeddings are on), idempotent `npm run seed -w services/search-api` by id. SR-2 unit tests; ES_INTEGRATION=1 test written, not run locally (no Docker on this Mac).
- 2026-11-09 13:00  W.1  Danny (Codex)  Brand-system frame, local fonts, all route previews, shared typed/validated API client, 12-talk/3-attendee memory fixtures, loading/error recovery, scoped dungeon theme variables. WEB-1/WEB-12/WEB-14 tests; full tests, lint, typecheck and production build pass. Browser host unavailable; visual QA remains for the next browser session. Theme studio recorded as W.5a, not implemented here.
- 2026-11-09 13:05  S.3  Max (Claude)  GET /talks (fuzzy multi_match, 160-char abstract highlight), /talks/:id, /speakers/:id, /readyz checks the indexes. TalkStore with EsTalkStore and an in-memory store over the committed schedule, which search-api also serves when ELASTICSEARCH_URL is unset. SR-3, SR-4, SR-11, SR-12 tests.
- 2026-11-09 13:30  S.R1  Jake Nef (Codex)  Fixed CQ-REVIEW-004 with GET /api/search/rooms and SearchRoomsResponse, complete composite aggregation over room names, memory/HTTP implementations and Game conference integration. Regression exercises the committed 480-talk schedule and all 28 rooms without network calls.
- 2026-11-09 13:15  S.4  Max (Claude)  conquest-embeddings inference endpoint (OpenAI text-embedding-3-small) created on start and before seeding when OPENAI_API_KEY is set; semantic_text field; rrf retriever with a one-way fallback to bool.should (semantic 2x) when refused; `seed -- --recreate`. Unit tests for every fallback; SR-5 is an ES_INTEGRATION=1 + OPENAI_API_KEY test, not run here (no Docker, no key).
- 2026-11-09 13:10  P.3  Jake Nef (Claude)  packages/telemetry: startTelemetry (NodeSDK, auto-instrumentations, OTLP/HTTP traces+metrics+logs to Dash0, ESM hook), log() with trace_id/span_id. PL-1, PL-2 tests. Smoke-tested under tsx against a local OTLP receiver: HTTP server spans, traces/metrics/logs all exported with the bearer header. Services not wired yet (their index.ts is Search/Game lane); README shows the 3-line entry.
- 2026-11-09 13:30  P.R1  Jake Nef (Codex)  Fixed CQ-REVIEW-005: copy apps/web/public into the runtime image. Added CI smoke test that builds/runs the production image and compares HTTP font responses byte-for-byte with the committed TTF files. Local standalone smoke verifies fonts; Docker daemon is unavailable locally, so the real image check runs in CI.
- 2026-11-09 13:17  W.2  Danny (Codex)  Two-screen signup with LinkedIn format validation, optional local photo crop/compression, four editable classes, suggested/custom goals, saved attendee identity, personal map, shared photo/sprite avatars, and reload-safe tab demo data. Tests cover WEB-2, WEB-15, WEB-16, keyboard signup, failed requests and duplicate-submit prevention; tests/lint/typecheck/build verified before PR.
- 2026-11-09 13:37  W.2 visual follow-up  Danny (Codex)  Replaced placeholder character sprites with four detailed pixel-art PNGs based on the user reference; full-body selection preview and portrait tiles, refined navigation/selection/class icons. Existing WEB-16 and signup regression tests pass. Web Docker runtime now copies public assets so character art and fonts are served in production.
- 2026-11-09 13:46  W.2 delivery follow-up  Danny (Codex)  Serve detailed character art through Next Image with portrait-aware sizes, small avatar widths and quality 100. Source PNGs remain intact; production delivery verified against the optimized endpoint. Addresses Gitar performance suggestion from PR #43.
- 2026-11-09 13:25  S.5  Max (Claude)  POST /rank: one search per goal plus the about text at half weight (top 20 each, in parallel), reciprocal rank fusion (k=60), clash-free walk, reasons, time order. SR-6..SR-9 tests on the real schedule and on pure fusion.
- 2026-11-09 13:35  S.6  Max (Claude)  POST /suggest-goals: one request with a sampler (top 50 BM25 hits) of tag/track terms plus a global tag count; drops formats and tags on >60% of talks, tops up to 3, title-cases with acronyms. SR-10 tests on the real schedule.
- 2026-11-09 14:10  S.5 follow-up  Max (Claude)  /rank picks one boss per goal before filling by fused order (SR-13); all spec open questions resolved (000, 010, 020, 030, 040).

- 2026-11-09 13:26  G.R1  Jake Nef (Codex)  Fixed review findings CQ-REVIEW-001..003: versioned attendee XP journal/outbox with replay on startup, attendee reads and aggregate reads; atomic action limits and network/quest deduplication; attendee party claims with rollback on failed joins. Cross-instance concurrency and failed-write regressions use in-memory stores only.
- 2026-11-09 14:40  S.7  Max (Claude)  search.rank span with a search.rank.query child per search, conquest.search.rank.duration histogram (ms, outcome), goals_count/limit/bosses_count attributes, errors by class only; main.ts logs via @conquest/telemetry. Tests check no goal/about/talk text reaches telemetry.
- 2026-11-09 14:50  S follow-up  Max (Claude)  search-api /readyz is 503 until conquest-talks and conquest-speakers hold documents, not just exist.
- 2026-11-09 15:00  S follow-up  Max (Claude)  `npm run verify` (read-only 020 checks against the .env cluster), `npm run demo` + DEMO-SNAPSHOT.md (in-memory for now), search-api README with slide text; tags get a lowercase normalizer so title-cased goals match their tags.

- 2026-11-09 W.3 Danny/Codex: separate DungeonMap component with chronological path/list, reduced-motion list default, keyboard toggles, step-free path filter and persistent list access notes. Fetch selected boss details directly so the search page limit cannot hide mapped talks. WEB-3..WEB-5 regression tests; 234 tests pass (3 integration skips), lint, typecheck and production build pass. Browser host unavailable; visual QA pending.

- 2026-11-09 W.3 visual follow-up Danny/Codex: illustrated keynote and workshop boss rooms matching the existing detailed character art; chronological connected trail with stable stop numbers, room labels, speaker names and full-card encounter links. Accessible list and step-free filtering retained. Selected-talk fetches tolerate individual failures and show an explicit missing-talk notice (PR #49 review finding). Tests, lint, typecheck and production build pass; browser visual QA remains pending.
- 2026-11-09 15:30  S.4 live  Max (Claude)  search-api reuses an existing embeddings endpoint without a pod key and re-detects semantic mode every 60 s, so `seed -- --recreate` from a laptop turns semantic search on live.
