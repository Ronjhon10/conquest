# Build

The checklist, split into four lanes that run at the same time. Each step names the spec and criteria it builds. Take the first unticked step **in your lane**, put your name on it, build it on your own branch (`<name>/<lane>-<thing>`), open a PR, let Gitar and CI pass, merge, tick it. Specs: [000](../specs/000-overview.md) (read first), [010](../specs/010-platform.md), [020](../specs/020-search.md), [030](../specs/030-game.md), [040](../specs/040-web.md).

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

- [x] **P.1** CI workflow (lint, typecheck, test) and `main` ruleset (PR + green `ci`, Actions bypass). (PL-4) owner: Max
- [ ] **P.2** Gitar: config committed (`.gitar/`); **human** starts the trial and installs the app; turn on auto-apply. (PL-9) owner:
- [ ] **P.3** `packages/telemetry` with `startTelemetry`. (PL-1, PL-2) owner:
- [ ] **P.4** `docker-compose.yml` for the three apps (Dockerfiles, manifests, Argo CD app and deploy workflow are done). (PL-3) owner:
- [ ] **P.5** **Human:** Radar cluster (join.cnh.radarhq.io), `./deploy/setup-team.sh <team>` PR, everyone connects Radar MCP, Checks "before" screenshot. (PL-8) owner:
- [ ] **P.6** **Human:** Elastic Serverless project, Dash0 account and tokens, Secret `conquest-secrets`. Then the agent `get-started` skill applies `argocd/application.yaml`; first GitOps deploy verified on the URL. Seed Job. (PL-5) owner:
- [ ] **P.7** Dash0: verify traces/RUM/logs arrive; "Conquest live" dashboard + XP SLO; Dash0 MCP/Agent0 connected. (PL-6, PL-7) owner:
- [ ] **P.8** Load script `scripts/load/`; evidence folder filled as things happen. (PL-10) owner:

## Lane: Search (020)

- [ ] **S.1** Scrape KubeCon NA 2026 schedule → `data/kubecon-na-2026.ndjson` (talks + speakers). (SR-1) owner:
- [ ] **S.2** Index mappings, idempotent seed. (SR-2) owner:
- [ ] **S.3** `GET /talks` hybrid search with highlight and fuzziness; `GET /talks/:id`, `GET /speakers/:id`. (SR-3, SR-4, SR-11, SR-12) owner:
- [ ] **S.4** Embeddings inference endpoint + `semantic_text`; RRF with fallback. (SR-5) owner:
- [ ] **S.5** `POST /rank`: per-goal search, fusion, clash-free pick, reasons, time order. (SR-6..SR-9) owner:
- [ ] **S.6** `POST /suggest-goals` from aggregations. (SR-10) owner:
- [ ] **S.7** Telemetry spans/metrics per 020 Behavior 6. owner:

## Lane: Game (030)

- [ ] **G.1** Index setup, Elasticsearch repository layer, fake search client. owner:
- [ ] **G.2** Conferences: create with theme (OpenAI + fallback + contrast check), default quests, rooms, quests/rooms PUT. (GM-1..GM-3) owner:
- [ ] **G.3** Attendees: draft (class + goals) and create (LinkedIn URL normalize, profile photo, code, map via rank, goal quests), allies. (GM-4, GM-5, GM-19..GM-21) owner:
- [ ] **G.4** XP rules module and `POST /xp` for checkin, photo, network; coins on boss check-in; levels; optimistic concurrency. (GM-6..GM-9, GM-11, GM-17) owner:
- [ ] **G.5** Parties and the 1.25x bonus. (GM-7, GM-12) owner:
- [ ] **G.6** Quest completion. (GM-10) owner:
- [ ] **G.7** Coins and speaker recognition. (GM-13) owner:
- [ ] **G.8** Leaderboard and report aggregations. (GM-14, GM-15) owner:
- [ ] **G.9** Recap (OpenAI + template). (GM-16) owner:
- [ ] **G.10** `xp.award` telemetry. (GM-18) owner:

## Lane: Web (040)

- [ ] **W.1** App shell, theme CSS variables, typed API client with `NEXT_PUBLIC_FAKE_API` fakes and fixtures. (WEB-1, WEB-12, WEB-14) owner:
- [ ] **W.2** Attendee signup flow with LinkedIn link and profile photo. (WEB-2, WEB-15, WEB-16) owner:
- [ ] **W.3** Dungeon map: visual path + list view + step-free toggle. (WEB-3..WEB-5) owner:
- [ ] **W.4** Boss page (check in, photo, coin), connect page (QR + typed code + allies), party page, XP feedback. (WEB-6, WEB-11, WEB-17) owner:
- [ ] **W.5** Organizer: new, setup (theme, quests, rooms), live leaderboard, report. (WEB-7, WEB-13) owner:
- [ ] **W.6** Recap page and speaker page. (WEB-8) owner:
- [ ] **W.7** RUM + traceparent. owner:
- [ ] **W.8** Accessibility tests: axe + keyboard-only Playwright flows. (WEB-9, WEB-10) owner:

## Integration and demo (everyone, from 3:00)

- [ ] **I.1** Turn off fakes on the cluster; run the 000 demo path on the public URL. (OV-1) owner:
- [ ] **I.2** `demo/script.md` (two minutes, timed) and the tech slides with evidence from `demo/evidence/`. owner:
- [ ] **I.3** Record the video; submit. owner:

## Log

<!-- YYYY-MM-DD HH:MM  step  who  what -->
- 2026-11-09 11:40  0.1  Max (Claude)  Workspace, packages/contracts (schemas, route bodies, INDEX names, fixtures), search-api + game-api skeletons with 501 stubs per route, Next app shell. 12 tests green; typecheck, lint, next build pass.
- 2026-11-09 12:10  P.1 + tooling  Max (Claude)  CI, main ruleset, Gitar review conventions + 5 rules, Radar cnh-starter layout (deploy/, argocd/, build-and-deploy, skills), specs 000/010 aligned with research.
