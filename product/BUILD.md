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
- [ ] **P.W2** XP latency: on the live cluster `POST /api/game/xp` check-ins now succeed but take 4-6 s each (measured 2026-11-09 15:05 MT, after #71); 010/030 target p95 < 300 ms. Investigate with Dash0 + Radar first (AGENTS rule 13), save evidence. owner: Jake Nef
- [ ] **P.W1** Web help (split 2026-11-09, see Lane: Web "Helping on Web"): recap page and speaker recognition page (WEB-8, was W.6), then RUM + traceparent (was W.7). Allowed files: new `apps/web/src/components/recap.tsx`, `apps/web/src/components/speaker.tsx`, RUM setup in `apps/web/app/layout.tsx`. Calls: `api.recap`, `api.recognition`. owner: Jake Nef
- [ ] **P.4** `docker-compose.yml` for the three apps (Dockerfiles, manifests, Argo CD app and deploy workflow are done). (PL-3) owner: Jake Nef
- [ ] **P.5** **Human:** Radar cluster (join.cnh.radarhq.io), `./deploy/setup-team.sh <team>` PR, everyone connects Radar MCP, Checks "before" screenshot. (PL-8) owner: Jake Nef
- [x] **P.6** **Human:** Elastic Serverless project, Dash0 account and tokens, Secret `conquest-secrets`. Then the agent `get-started` skill applies `argocd/application.yaml`; first GitOps deploy verified on the URL. Seed Job. (PL-5) owner: Jake Nef
- [ ] **P.7** Dash0: verify traces/RUM/logs arrive; "Conquest live" dashboard + XP SLO; Dash0 MCP/Agent0 connected. (PL-6, PL-7) owner: Jake Nef
- [ ] **P.8** Load script `scripts/load/`; evidence folder filled as things happen. (PL-10) owner: Jake Nef

- [x] **P.R1** Include public web assets in the standalone image and verify bundled fonts in the production-container CI smoke test. (PL-5, WEB-1) owner: Jake Nef
- [x] **P.R2** Sanitize unhandled service errors and keep trace-correlated logging without personal backend text. (OV-4, 000 telemetry conventions) owner: Jake Nef

## Lane: Search (020)

- [x] **S.1** Scrape KubeCon NA 2026 schedule → `data/kubecon-na-2026.ndjson` (talks + speakers). (SR-1) owner: Max
- [x] **S.2** Index mappings, idempotent seed. (SR-2) owner: Max
- [x] **S.3** `GET /talks` hybrid search with highlight and fuzziness; `GET /talks/:id`, `GET /speakers/:id`. (SR-3, SR-4, SR-11, SR-12) owner: Max
- [x] **S.4** Embeddings inference endpoint + `semantic_text`; RRF with fallback. (SR-5) owner: Max
- [x] **S.5** `POST /rank`: per-goal search, fusion, clash-free pick, reasons, time order. (SR-6..SR-9) owner: Max
- [x] **S.6** `POST /suggest-goals` from aggregations. (SR-10) owner: Max
- [x] **S.7** Telemetry spans/metrics per 020 Behavior 6. owner: Max
- [ ] **S.W1** Web help (split 2026-11-09, see Lane: Web "Helping on Web"): front page links point at the live demo conference instead of `conf-demo` (it 404s live), then the new-conference form and the report page (WEB-7, from W.5), then a live talk search box on the front page. Allowed files: `apps/web/src/components/landing.tsx`, new `apps/web/src/components/organizer-new.tsx`, new `apps/web/src/components/report.tsx`. Calls: `api.createConference`, `api.report`, `api.talks`. owner: Max

- [x] **S.R1** Complete room-discovery contract and Game conference integration, independent of talk-search limits. (OV-2, GM-3) owner: Jake Nef
- [x] **S.R2** Repair completed map backfill beyond the first schedule page and keyword fallback during inference outages. (GM-5, SR-11, OV-2, OV-5) owner: Jake Nef

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
- [x] **G.R2** Live QA: rebuild a game index whose live mapping can't search a field we filter on, keeping its documents (issue #61). (GM-23) owner: Jake Nef
- [x] **G.R3** Live QA: game-api writes refresh explicitly instead of wait_for so check-in and network finish under the proxy timeout on Serverless (issue #62). (GM-6, GM-14, GM-17) owner: Jake Nef
- [x] **G.R4** Review repairs: legacy-safe and atomic character recovery, durable coin gifts, and latest conference quest synchronization, indexed recovery fast paths and organizer quest validation. (GM-13, GM-22, GM-23) owner: Jake Nef
- [x] **G.W1** Web help (split 2026-11-09, see Lane: Web "Helping on Web"): connect page (show my code as QR + text, type a friend's code, allies list), party page (create, join, members), and a coin button for the boss page (WEB-6, WEB-11, from W.4). Allowed files: new `apps/web/src/components/connect.tsx`, `apps/web/src/components/party.tsx`, `apps/web/src/components/coin.tsx`. Calls: `api.awardXp` (kind `network`), `api.createParty`, `api.joinParty`, `api.giveCoin`, `api.attendee`. owner: Jacob Bingham

## Lane: Web (040)

### Helping on Web (split 2026-11-09, freeze 4:30)

Danny owns this lane; the other three lanes each took a slice so it lands by the freeze. Their steps are **S.W1** (Max), **G.W1** (Jacob) and **P.W1** (Jake), in their own lane sections. Rules for anyone working one of those steps:

1. Touch only the files your step lists. Build each view as a **new** component in `apps/web/src/components/`. Don't edit `route-preview.tsx`, `ui.tsx` or `api.ts`: Danny adds the one-line branch that renders your view. Say in your PR which view name and route it is for.
2. Use the existing client in `apps/web/src/lib/api.ts` (every API call already exists) and the existing look (`Panel`, `ActionLink`, `cq-card`, `Icon`). No new API calls, no contract changes.
3. Read `apps/web/AGENTS.md` first: this Next.js version differs from what agents expect.
4. Develop with `NEXT_PUBLIC_FAKE_API=1`. Test live against the demo conference `d2927cdd-f3e6-404f-b34f-4c4b766b8520` (KubeCon NA 2026, 8 made-up players): `https://conquest.cnh.radarhq.io/c/d2927cdd-f3e6-404f-b34f-4c4b766b8520/join`.
5. One small PR per view, auto-merge on. Your own branch or worktree, never a shared checkout.

Order: by 3:45 the demo blockers (W.4 check-in and photo, S.W1 links); by 4:30 the rest. Cut unless someone is idle: W.5a theme studio, quest and room editors, keyboard-only Playwright flows.


- [x] **W.1** App shell, theme CSS variables, typed API client with `NEXT_PUBLIC_FAKE_API` fakes and fixtures. (WEB-1, WEB-12, WEB-14) owner: Danny
- [x] **W.2** Attendee signup flow with LinkedIn link and profile photo. (WEB-2, WEB-15, WEB-16) owner: Danny
- [x] **W.2b** Optional LinkedIn OpenID Connect profile import, credential setup and recovery. (WEB-21..WEB-23) owner: Danny
- [x] **W.2c** **Human activation:** enable the LinkedIn developer app's OpenID Connect product, add client ID/secret to the Web runtime settings, then verify a real consent round trip. User confirmed the newest version worked after the live compatibility fixes. Setup: `apps/web/LINKEDIN_SETUP.md`. owner: Danny
- [ ] **W.2d** Photo-based character likeness, consistent class outfits, profile editor and saved map avatars. (WEB-24..WEB-26) owner: Danny
- [x] **W.3** Dungeon map: visual path + list view + step-free toggle. (WEB-3..WEB-5) owner: Danny
- [ ] **W.4** Boss page: check in, photo, XP feedback (WEB-6, WEB-17); merge #59; then wire in the helpers' views (S.W1, G.W1, P.W1) as their PRs land. Connect, party and coin moved to G.W1 (Jacob). owner: Danny
- [ ] **W.5** Organizer: setup page and live leaderboard (WEB-13). New-conference form and report moved to S.W1 (Max). Quest and room editors: cut unless time. owner: Danny
- [ ] **W.5a** (cut unless idle: no API changes a theme and the cluster has no OpenAI key) Organizer theme studio: description → preview → revise/apply, themed map scenery and optional background within Conquest's consistent style. Coordinate theme preview/update and presentation contracts with Game before integration. (WEB-18..WEB-20) owner: Danny
- [ ] **W.6** Recap page and speaker page: moved to P.W1 (Jake). owner: Jake Nef
- [ ] **W.7** RUM + traceparent: moved to P.W1 (Jake). owner: Jake Nef
- [ ] **W.8** Accessibility: one axe test over the finished pages (WEB-9); keyboard-only Playwright flows (WEB-10) cut unless time. owner: whoever finishes first

- [x] **W.logo** User-requested portal branding: shared website/footer/map logo, browser and Apple home-screen icons, brand usage guide. Existing WEB-1 and WEB-10 regressions cover shell/accessibility; merge remains gated by CI. owner: Jacob Bingham (Codex)

## Integration and demo (everyone, from 3:00)

- [ ] **I.1** Turn off fakes on the cluster; run the 000 demo path on the public URL. (OV-1) owner:
- [ ] **I.2** `demo/script.md` (two minutes, timed) and the tech slides with evidence from `demo/evidence/`. owner:
- [ ] **I.3** Record the video; submit. owner:

## Log

<!-- YYYY-MM-DD HH:MM  step  who  what -->
- 2026-11-09 14:54  W.2c  Danny (Codex)  User confirmed the newest LinkedIn sign-in version worked after correcting the live issuer and nonce compatibility. Developer-app activation and a real consent round trip are verified locally. No production deployment performed.
- 2026-11-09 14:52  W.2b live fix  Danny (Codex)  Safe diagnostics identified stale issuer validation followed by a missing nonce in LinkedIn's real token. Matched the live discovery issuer and used LinkedIn's confidential code flow with mandatory state, server-side client authentication and full signature/issuer/audience/expiry/subject checks. Old nonce-based transactions require a fresh sign-in. Actual callback returned connected after the fix; on-screen photo import still awaiting user confirmation. Full suite 285 passed/3 skipped, typecheck/lint/build pass.
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
- 2026-11-09 14:40  S.R2  Jake Nef (Codex)  Added bounded empty-query schedule pagination through shared contracts and Game/Search interfaces so completed signup backfill can reach later non-clashing talks. Inference failures now fall back to BM25 and retry semantic detection later. Regressions cover the HTTP seam, page ordering, concurrent failures and recovery; no unfinished screens implemented.
- 2026-11-09 14:54  S.R2 test naming  Jake Nef (Codex)  Named the existing inference-outage regression OV-5 to match the fallback criterion it exercises; no runtime behavior changed.
- 2026-11-09 13:15  S.4  Max (Claude)  conquest-embeddings inference endpoint (OpenAI text-embedding-3-small) created on start and before seeding when OPENAI_API_KEY is set; semantic_text field; rrf retriever with a one-way fallback to bool.should (semantic 2x) when refused; `seed -- --recreate`. Unit tests for every fallback; SR-5 is an ES_INTEGRATION=1 + OPENAI_API_KEY test, not run here (no Docker, no key).
- 2026-11-09 13:10  P.3  Jake Nef (Claude)  packages/telemetry: startTelemetry (NodeSDK, auto-instrumentations, OTLP/HTTP traces+metrics+logs to Dash0, ESM hook), log() with trace_id/span_id. PL-1, PL-2 tests. Smoke-tested under tsx against a local OTLP receiver: HTTP server spans, traces/metrics/logs all exported with the bearer header. Services not wired yet (their index.ts is Search/Game lane); README shows the 3-line entry.
- 2026-11-09 13:30  P.R1  Jake Nef (Codex)  Fixed CQ-REVIEW-005: copy apps/web/public into the runtime image. Added CI smoke test that builds/runs the production image and compares HTTP font responses byte-for-byte with the committed TTF files. Local standalone smoke verifies fonts; Docker daemon is unavailable locally, so the real image check runs in CI.
- 2026-11-09 14:35  P.R2  Jake Nef (Codex)  Fixed raw backend error messages/stacks reaching service logs. Both APIs now emit a static message and error class through the existing telemetry logger. Regression tests verify the generic 500 contract and absence of synthetic personal text; no unfinished product flows changed.
- 2026-11-09 13:17  W.2  Danny (Codex)  Two-screen signup with LinkedIn format validation, optional local photo crop/compression, four editable classes, suggested/custom goals, saved attendee identity, personal map, shared photo/sprite avatars, and reload-safe tab demo data. Tests cover WEB-2, WEB-15, WEB-16, keyboard signup, failed requests and duplicate-submit prevention; tests/lint/typecheck/build verified before PR.
- 2026-11-09 13:37  W.2 visual follow-up  Danny (Codex)  Replaced placeholder character sprites with four detailed pixel-art PNGs based on the user reference; full-body selection preview and portrait tiles, refined navigation/selection/class icons. Existing WEB-16 and signup regression tests pass. Web Docker runtime now copies public assets so character art and fonts are served in production.
- 2026-11-09 13:46  W.2 delivery follow-up  Danny (Codex)  Serve detailed character art through Next Image with portrait-aware sizes, small avatar widths and quality 100. Source PNGs remain intact; production delivery verified against the optimized endpoint. Addresses Gitar performance suggestion from PR #43.
- 2026-11-09 13:25  S.5  Max (Claude)  POST /rank: one search per goal plus the about text at half weight (top 20 each, in parallel), reciprocal rank fusion (k=60), clash-free walk, reasons, time order. SR-6..SR-9 tests on the real schedule and on pure fusion.
- 2026-11-09 13:35  S.6  Max (Claude)  POST /suggest-goals: one request with a sampler (top 50 BM25 hits) of tag/track terms plus a global tag count; drops formats and tags on >60% of talks, tops up to 3, title-cases with acronyms. SR-10 tests on the real schedule.
- 2026-11-09 14:10  S.5 follow-up  Max (Claude)  /rank picks one boss per goal before filling by fused order (SR-13); all spec open questions resolved (000, 010, 020, 030, 040).

- 2026-11-09 13:26  G.R1  Jake Nef (Codex)  Fixed review findings CQ-REVIEW-001..003: versioned attendee XP journal/outbox with replay on startup, attendee reads and aggregate reads; atomic action limits and network/quest deduplication; attendee party claims with rollback on failed joins. Cross-instance concurrency and failed-write regressions use in-memory stores only.
- 2026-11-09 14:34  G.R4  Jake Nef (Codex)  Reproduced and fixed legacy LinkedIn index queries, racing duplicate signup, lost coin gifts after failed writes, and stale quests from concurrent edits. Deterministic linked-character create IDs, paginated legacy scans, coin outbox replay and async versioned quest sync; only completed Game behavior changed. Regression tests use local stores.
- 2026-11-09 14:49  G.R4 follow-up  Jake Nef (Codex)  Addressed Gitar feedback: normal linked signup uses an indexed lookup before any legacy scan; PUT conference quests rejects personal goal kinds, and syncing removes legacy shared goal entries while preserving genuine personal goals. Added regression coverage and updated the contract/spec together.
- 2026-11-09 14:40  S.7  Max (Claude)  search.rank span with a search.rank.query child per search, conquest.search.rank.duration histogram (ms, outcome), goals_count/limit/bosses_count attributes, errors by class only; main.ts logs via @conquest/telemetry. Tests check no goal/about/talk text reaches telemetry.
- 2026-11-09 14:50  S follow-up  Max (Claude)  search-api /readyz is 503 until conquest-talks and conquest-speakers hold documents, not just exist.
- 2026-11-09 15:00  S follow-up  Max (Claude)  `npm run verify` (read-only 020 checks against the .env cluster), `npm run demo` + DEMO-SNAPSHOT.md (in-memory for now), search-api README with slide text; tags get a lowercase normalizer so title-cased goals match their tags.
- 2026-11-09 13:55  P.5 (part)  Jake Nef (Claude)  Radar team cluster `conquest` (id yka3x0NpFNY), Radar MCP connected for Jake, setup-team PR #47, Checks "before" in demo/evidence (3 Medium, PR #46). Still open in P.5: each teammate connects Radar MCP.
- 2026-11-09 13:55  P.6  Jake Nef (Claude)  Elastic Serverless + Dash0 set up; Secret conquest-secrets created with deploy/create-secret.sh (values never left the terminal). Argo CD Application applied and synced through Radar at deploy 2a32eff (images 7e388e5); starter app pruned. search-api stayed 0/1 Ready: Radar diagnose showed /readyz 503 because the fresh indexes were empty (readyz requires seeded talks by design). Ran one-off Job search-seed-001 (search-api image, src/seed-cli.ts): 480 talks, 703 speakers; search-api went Ready. PL-5 verified on https://conquest.cnh.radarhq.io: / serves web, /api/search/healthz and /api/game/healthz 200, /api/search/talks returns real talks.

- 2026-11-09 W.3 Danny/Codex: separate DungeonMap component with chronological path/list, reduced-motion list default, keyboard toggles, step-free path filter and persistent list access notes. Fetch selected boss details directly so the search page limit cannot hide mapped talks. WEB-3..WEB-5 regression tests; 234 tests pass (3 integration skips), lint, typecheck and production build pass. Browser host unavailable; visual QA pending.

- 2026-11-09 W.3 visual follow-up Danny/Codex: illustrated keynote and workshop boss rooms matching the existing detailed character art; chronological connected trail with stable stop numbers, room labels, speaker names and full-card encounter links. Accessible list and step-free filtering retained. Selected-talk fetches tolerate individual failures and show an explicit missing-talk notice (PR #49 review finding). Tests, lint, typecheck and production build pass; browser visual QA remains pending.
- 2026-11-09 15:30  S.4 live  Max (Claude)  search-api reuses an existing embeddings endpoint without a pod key and re-detects semantic mode every 60 s, so `seed -- --recreate` from a laptop turns semantic search on live.
- 2026-11-09 16:20  S.4 live  Max (Claude)  Reseeded Serverless with embeddings (480 talks, 703 speakers, semantic on). `npm run verify` live: 7/8 pass; SR-5 fixed by weighting semantic 2x in RRF.

- 2026-11-09 W.3 structure correction Danny/Codex: replaced room-card trail with the original Claude map structure (02 Map · 16-bit): connected top-down chambers and corridors, day selection, XP HUD, existing sprites and one floating selected-boss panel. List view retains all days and access notes; step-free filtering selects a valid visible room. Keyboard selection and venue-day regressions added. Character files and Avatar are unchanged. Automated checks pass; local browser visual QA pending.
- 2026-11-09 16:40  S.6 live  Max (Claude)  suggest-goals samples exactly the top 50 hits (Serverless sampler was ~300); `npm run verify` live 8/8; DEMO-SNAPSHOT.md regenerated from Elasticsearch (hybrid, RRF).
- 2026-11-09 15:35  P.7  Jake Nef (Claude)  Dash0 MCP (Agent0) and CLI connected. observability/dash0/: "Conquest live" dashboard, XP SLO (99% of xp.award succeed) and XP p95 > 300 ms check rule, applied with `dash0 apply` (idempotent). Live data confirmed: traces from both services, XP and check-in metrics, rank p95. Agent0 investigated 31 game-api ERROR spans: the web app's hardcoded `conf-demo` conference 404s on the cluster (demo/evidence/2026-11-09-1525-*). deploy/web.yaml carries the dashboard URL for the organizer view (W.5). Still open for P.7: RUM (W.7), organizer link in web (W.5).
- 2026-11-09 14:40  G.R2  Jake Nef (Claude)  Live e2e QA found signup 500 (linkedin_url not indexed in the live attendees index, Radar logs). ensureIndexes rebuilds stale indexes keeping documents; GM-23 tests; verified against Serverless on scratch indexes.
- 2026-11-09 14:45  G.R3  Jake Nef (Claude)  Live e2e QA: check-in and network were 504 (15 s), party/coin 9-10 s; Dash0 game-api p95 10.9 s. Root cause refresh wait_for on Serverless (~4.3 s per write). Switched to refresh=true (~0.5 s), test pins it.

- 2026-11-09 W.3 phone screen Danny/Codex: rebuilt the full map route around the supplied Cobalt reference (saved in apps/web/design-references/). Integrated player summary, day/access controls, world, encounter panel, action buttons, quests panel and bottom navigation. Map-only shell removes surrounding website chrome; other pages and character artwork unchanged. 287 tests pass after integrating concurrent changes; lint/typecheck/production build pass; browser visual QA pending.
- 2026-11-09 15:50  Radar after  Jake Nef (Claude)  Checks for team-conquest went from 3 Medium to 0 (PR #66: 2 replicas, PDBs, topology spread, no SA token, preStop drain). The rollout hit team-quota limits.cpu (10, platform included); Radar diagnose found it, PR #73 lowered CPU limits, and all Deployments are 2/2. Evidence: demo/evidence/2026-11-09-1550-radar-checks-after.*. P.8 load script in #65; the smoke run found 10 s XP check-ins (refresh wait_for, Game lane), evidence in #68.
- 2026-11-09 15:10  Web split  Max (Claude)  Remaining Web work split across lanes so it lands by the freeze: S.W1 Max, G.W1 Jacob, P.W1 + P.W2 Jake, W.4/W.5 Danny; helper rules under Lane: Web. Live demo conference d2927cdd-f3e6-404f-b34f-4c4b766b8520 created and seeded with 8 made-up players.

- 2026-11-09 W.3 button consistency Danny/Codex: map day/filter controls, action buttons, quest close and bottom navigation now reuse cq-btn/cq-btn--secondary from the other pages. Removed map-specific font weights, borders, corners and shadows; retained responsive sizing and title-case labels from the phone reference. Existing map/shell tests, lint and production build pass.
- 2026-11-09 16:20  G.W1  Jacob (Claude + Sonnet agents)  Connect (#83: QR + text code, typed code awards network XP, allies; adds qrcode dep), party (#82: create/join/members, x1.25 note) and coin button (#81: CoinButton for the boss page) as new components; Danny wires them into route-preview. Fake API has no /xp route, so connect submit errors under NEXT_PUBLIC_FAKE_API=1.

- 2026-11-09 W.logo Jacob Bingham (Codex): implemented the user-approved portal concept as compact vector artwork, integrated shared branding across the site and map, added automatic favicon/Apple icon metadata and brand guidance. Initial PNG-based shell/map/foundation suite passed 17 tests locally; workspace disconnected before production build. Final vector implementation is validated by the required PR CI (lint, typecheck, tests and production image smoke) before auto-merge.
