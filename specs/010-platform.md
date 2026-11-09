# 010: Platform

Status: Accepted
Prefix: `PL`
Lane: Platform
Owner:

## Purpose

Gets Conquest running on Kubernetes and makes three sponsor tracks real: **Radar** (AI SRE on our cluster), **Dash0** (OpenTelemetry everywhere, a live dashboard and SLO), and **Sonar/Gitar** (every PR reviewed, CI failures diagnosed and auto-fixed). Owns the cluster setup, the Elastic Serverless project, telemetry wiring to Dash0, CI, GitOps deploys, Gitar config, the Radar agent skills, and `packages/telemetry`. We run on the **hackathon's Radar vcluster** using Radar's `cnh-starter` layout (decided 2026-11-09 from `research/hackathon-tools.md`). Operational details: `deploy/README.md`. It also collects the **evidence** each track's judges want (screenshots and links in `demo/evidence/`).

## Non-goals

- Helm charts of our own (plain kustomize is enough).
- Elasticsearch inside the cluster (the budget is 2 CPU / 4 GiB requests; we use Elastic Serverless).
- An OTel collector or any node agent in the cluster (privileged/host pods are refused; services export straight to Dash0).
- Autoscaling, canary releases, backups, our own TLS (the platform serves HTTPS on the team URL).
- Faking an incident. The Radar and Dash0 findings must be real issues we hit (see Behavior 6).

## Interface

- `packages/telemetry`: `startTelemetry(serviceName: string): void` for Node services. Wraps `@opentelemetry/sdk-node` with auto-instrumentations (http, undici/fetch, Elasticsearch), OTLP exporters for traces, metrics and logs straight to Dash0 (endpoint and `Authorization=Bearer` header from env), and `deployment.environment` from `DEPLOY_ENV`. A no-op when `OTEL_EXPORTER_OTLP_ENDPOINT` is unset (tests, laptops).
- Dockerfiles: `apps/web/Dockerfile` (Next standalone) and `services/Dockerfile` (`--build-arg SERVICE=search-api|game-api`). All listen on `PORT` 8080 with `/healthz` and `/readyz`, run as uid 1000. Images: `ghcr.io/ronjhon10/conquest-{web,search-api,game-api}:<sha7>` and `:latest`, public.
- `deploy/`: kustomize for Argo CD, namespace `team-<team>`: Deployments `web`, `search-api`, `game-api` (1 replica each, requests 100m and 192-256Mi), Service `app` (port 80 → web, the only routed entry), internal Services `search-api` and `game-api` (port 80), the inert starter HTTPRoute, env from Secret `conquest-secrets` (every key optional; created by a human, never in git).
- `argocd/application.yaml`: Application `app` in `team-<team>` tracking branch `deploy`, path `deploy`, automated prune + self-heal. `deploy/setup-team.sh <team>` fills in the team name.
- `.github/workflows/ci.yml` on every PR and on main: `npm ci`, lint, typecheck, test. `.github/workflows/build-and-deploy.yaml` on push to main: build the three images and force-push branch `deploy` (main plus a `deploy: <sha7>` commit with the new tags); Argo CD tracks `deploy`.
- `.gitar/review/conventions.md` and five rules in `.gitar/rules/`.
- `.agents/skills/`: Radar's `get-started`, `ship`, `debug-failure`, `canary-release`, `demo-story` skills with Conquest notes on top.
- `docker-compose.yml` for local dev (later step): the three apps; Elasticsearch from Serverless or a local single node.

## Behavior

1. **Cluster.** The hackathon's Radar vcluster from join.cnh.radarhq.io (human steps in `deploy/README.md`). Deploys are GitOps: merging a PR to `main` builds images and Argo CD syncs them. Agents ship through the `ship` skill (PR, merge, wait for the deploy commit, sync through Radar, verify the URL shows the new version). Nobody applies app manifests to the cluster by hand.
2. **Elasticsearch.** Elastic Serverless project from the hackathon trial (https://ela.st/hack-kubecon). Endpoint and API key go in `conquest-secrets` and local `.env`. Pin every `inference_id`.
3. **OpenTelemetry → Dash0.** Services export OTLP straight to Dash0 with the token from `conquest-secrets` (`OTEL_EXPORTER_OTLP_HEADERS=Authorization=Bearer ...`). Web RUM uses Dash0's browser SDK with a separate **ingest-only** token from `NEXT_PUBLIC_DASH0_RUM_*`.
4. **Dash0 in the product.** Build a Dash0 dashboard "Conquest live" with: XP awarded per minute by kind, check-ins per talk, active attendees, p95 `search.rank.duration`, error rate per service. Add an SLO: `POST /api/game/xp` p95 latency under 300 ms and error rate under 1%. The organizer live view in web links to this dashboard. Connect the Dash0 MCP server (or use Agent0) in our coding agents.
5. **Radar.** Connect Radar (Radar Cloud account, agent installed in the cluster per Radar's setup) and add Radar's MCP server to our coding agents' config, documented in `deploy/README.md`. Use Radar's UI during deploys and debugging.
6. **Real issues, investigated.** Whenever something really breaks on the cluster (crashloop, OOMKilled, a failing probe, a slow query), run Radar's AI investigation and/or Dash0 Agent0 on it **before** fixing it by hand, then save to `demo/evidence/`: a screenshot of the findings, what the root cause was, and the PR that fixed it. If nothing has broken by 3:30 PM, run the load script (`scripts/load/` with k6 or autocannon: 50 virtual attendees doing check-ins and leaderboard reads for 2 minutes) against the deployed app; whatever real bottleneck shows up is the issue. Never inject a fake fault.
7. **Gitar (Sonar).** Install the Gitar GitHub App on `Ronjhon10/conquest`. Review instructions are in `.gitar/review/conventions.md`; the five rules (Pro trial limit) are files in `.gitar/rules/`:
   - Any change under `services/game-api/src/xp/` or to XP numbers must include or change a test whose name starts with a `GM-` criterion ID.
   - Any new or changed API route must match `packages/contracts`; a contract change must also edit `specs/000-overview.md`.
   - Every `<img>`, icon button and image-like element in `apps/web` needs alt text or an `aria-label` (Merge Forward).
   - No secrets, tokens or `.env` values in diffs; no personal text in telemetry attributes.
   - Every new player action is instrumented per the 000 telemetry conventions.
   - (Tests named by criterion ID is in the review conventions, not a separate rule.)
   Turn on CI failure diagnosis and auto-apply (`gitar auto-apply:on`). Protect `main` with a ruleset: PRs only, `ci` must pass, no bypass (deploy commits go to branch `deploy`). Save one Gitar review and one Gitar auto-fix to `demo/evidence/` as they happen.
8. **Images and deploy.** Merges to `main` build images and the Action writes the new tags to branch `deploy`, which Argo CD tracks. `main` itself only changes through PRs. Seed runs as a one-off Kubernetes Job using the search-api image (`npm run seed -w services/search-api`), following `examples/agent-workflows/README.md`.
9. **Radar all day.** Screenshot Checks for `team-<team>` in the first hour ("before") and before 5:30 ("after"), fixing findings that apply to our workloads. Use Radar's Topology, Timeline and MCP while shipping. The `demo-story` skill drafts the 5:30 story.

## Acceptance criteria

- **PL-1** `startTelemetry` is a no-op (no exporter created, no throw) when `OTEL_EXPORTER_OTLP_ENDPOINT` is unset.
- **PL-2** `startTelemetry("x")` sets `service.name` = `x` and `deployment.environment` from `DEPLOY_ENV` (default `dev`).
- **PL-3** `docker compose up` starts the three apps locally, and `GET /healthz` on each answers 200.
- **PL-4** CI runs lint, typecheck and tests on every PR and blocks merging when any fails.
- **PL-5** After Argo CD syncs `main`, pods for web, search-api and game-api are Ready in `team-<team>`, and on `https://<team>.cnh.radarhq.io` `/` serves the web app while `/api/search/healthz` and `/api/game/healthz` answer 200 from their services. (Checked through Radar; record the run in the BUILD.md log.)
- **PL-6** Traces from both services and RUM from the browser show up in Dash0, with one trace spanning browser → game-api → search-api → Elasticsearch for an attendee signup.
- **PL-7** The "Conquest live" Dash0 dashboard and the XP SLO exist and are linked from the organizer view.
- **PL-8** Radar is connected to the cluster and its MCP server works from at least one teammate's coding agent.
- **PL-9** Gitar reviews every PR with the rules above; `main` is protected.
- **PL-10** `demo/evidence/` holds: one Radar AI investigation of a real issue, one Dash0 Agent0/MCP finding, one Gitar review, one Gitar CI auto-fix, each with a one-paragraph note.
- **PL-11** No secret value appears in git; `.env.example` lists every variable from 000.

## Open questions

- Does Gitar's trial count toward required PR reviews? **Default:** no; `main` requires a PR and green `ci`, not an approval.
