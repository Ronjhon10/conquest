# 010: Platform

Status: Accepted
Prefix: `PL`
Lane: Platform
Owner:

## Purpose

Gets Conquest running on Kubernetes and makes three sponsor tracks real: **Radar** (AI SRE on our cluster), **Dash0** (OpenTelemetry everywhere, a live dashboard and SLO), and **Sonar/Gitar** (every PR reviewed, CI failures diagnosed and auto-fixed). Owns the cluster, the Elasticsearch install, the OTel collector, CI, the deploy, and `packages/telemetry`. It also collects the **evidence** each track's judges want (screenshots and links in `demo/evidence/`).

## Non-goals

- Helm charts of our own (plain kustomize is enough).
- Autoscaling, multiple replicas of Elasticsearch, backups, TLS certificates we manage ourselves (use whatever ingress/TLS the event cluster or a tunnel gives).
- Faking an incident. The Radar and Dash0 findings must be real issues we hit (see Behavior 6).

## Interface

- `packages/telemetry`: `startTelemetry(serviceName: string): void` (Node services) and `telemetryEnv()` docs for web RUM. Wraps `@opentelemetry/sdk-node` with auto-instrumentations (http, undici/fetch, Elasticsearch), OTLP exporters for traces, metrics, logs, and `deployment.environment` from `DEPLOY_ENV`. A no-op when `OTEL_EXPORTER_OTLP_ENDPOINT` is unset (tests, laptops without a collector).
- Each service and `apps/web` has a `Dockerfile` (Platform writes them; lanes may tune). Images: `ghcr.io/ronjhon10/conquest-<service>:<git-sha>` and `:main`.
- `deploy/k8s/`: kustomize base with namespace `conquest`, Deployments + Services for `web`, `search-api`, `game-api`, an Ingress routing `/`, `/api/search`, `/api/game` (000 Architecture), the ECK `Elasticsearch` resource, the OTel Collector, and a reference to Secret `conquest-secrets` (created by a human, never in git).
- `docker-compose.yml` at the root for local dev: Elasticsearch single node (security on, one API key or elastic password in `.env`), the three apps, and an OTel collector that prints to console. `npm run dev` works without Docker for any one app with fakes.
- CI: `.github/workflows/ci.yml` on every PR: `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`. `.github/workflows/images.yml` on push to main: build and push the images.

## Behavior

1. **Cluster.** Use the cluster the event gives the team. Record in `deploy/README.md`: how to get the kubeconfig, the public URL, and the exact commands to deploy (`kubectl apply -k deploy/k8s`, then `kubectl -n conquest rollout status ...`). A human runs the deploy (agents never deploy unless a human asks, per AGENTS.md).
2. **Elasticsearch.** Install the ECK operator, then a single-node `Elasticsearch` (8.x latest available or 9.x) with 2 GiB memory and a persistent volume if the cluster has a storage class (ephemeral otherwise; the seed can be re-run). Create an API key for the apps and put it in `conquest-secrets`. If the cluster can't fit it, fall back to Elastic Cloud trial and record that in `product/DECISIONS.md`.
3. **OpenTelemetry → Dash0.** Deploy an OpenTelemetry Collector (contrib image) in the namespace: OTLP receivers (gRPC 4317, HTTP 4318), batch processor, `k8sattributes` processor, exporter to Dash0's OTLP endpoint with the auth token from `conquest-secrets`. Services send to the collector, never straight to Dash0. Web RUM uses Dash0's browser SDK with its public client token (not a secret) from `NEXT_PUBLIC_DASH0_RUM_*`.
4. **Dash0 in the product.** Build a Dash0 dashboard "Conquest live" with: XP awarded per minute by kind, check-ins per talk, active attendees, p95 `search.rank.duration`, error rate per service. Add an SLO: `POST /api/game/xp` p95 latency under 300 ms and error rate under 1%. The organizer live view in web links to this dashboard. Connect the Dash0 MCP server (or use Agent0) in our coding agents.
5. **Radar.** Connect Radar (Radar Cloud account, agent installed in the cluster per Radar's setup) and add Radar's MCP server to our coding agents' config, documented in `deploy/README.md`. Use Radar's UI during deploys and debugging.
6. **Real issues, investigated.** Whenever something really breaks on the cluster (crashloop, OOMKilled, a failing probe, a slow query), run Radar's AI investigation and/or Dash0 Agent0 on it **before** fixing it by hand, then save to `demo/evidence/`: a screenshot of the findings, what the root cause was, and the PR that fixed it. If nothing has broken by 3:30 PM, run the load script (`scripts/load/` with k6 or autocannon: 50 virtual attendees doing check-ins and leaderboard reads for 2 minutes) against the deployed app; whatever real bottleneck shows up is the issue. Never inject a fake fault.
7. **Gitar (Sonar).** Install the Gitar GitHub App on `Ronjhon10/conquest`. Configure it per Gitar's docs with review instructions and these repo rules:
   - Any change under `services/game-api/src/xp/` or to XP numbers must include or change a test whose name starts with a `GM-` criterion ID.
   - Any new or changed API route must match `packages/contracts`; a contract change must also edit `specs/000-overview.md`.
   - Every `<img>`, icon button and image-like element in `apps/web` needs alt text or an `aria-label` (Merge Forward).
   - No secrets, tokens or `.env` values in diffs; no personal text in telemetry attributes.
   - Tests are named by criterion ID.
   Turn on CI failure diagnosis and auto-apply of fixes. Protect `main`: PRs only, CI must pass, at least one review (Gitar's counts). Save one Gitar review and one Gitar auto-fix to `demo/evidence/` as they happen.
8. **Images and deploy.** Merges to `main` build images. A human deploys by updating the image tag (`kustomize edit set image ...`) and applying. Seed runs as a one-off Kubernetes Job using the search-api image (`npm run seed -w services/search-api`).

## Acceptance criteria

- **PL-1** `startTelemetry` is a no-op (no exporter created, no throw) when `OTEL_EXPORTER_OTLP_ENDPOINT` is unset.
- **PL-2** `startTelemetry("x")` sets `service.name` = `x` and `deployment.environment` from `DEPLOY_ENV` (default `dev`).
- **PL-3** `docker compose up` starts Elasticsearch and the three apps locally, and `GET /healthz` on each answers 200.
- **PL-4** CI runs lint, typecheck and tests on every PR and blocks merging when any fails.
- **PL-5** `kubectl apply -k deploy/k8s` on the event cluster produces running pods for web, search-api, game-api, Elasticsearch and the collector, and on the public URL `/` serves the web app while `/api/search/healthz` and `/api/game/healthz` answer 200 from their services. (Checked by hand; record the run in BUILD.md log.)
- **PL-6** Traces from all three services and RUM from the browser show up in Dash0, with one trace spanning web → game-api → search-api → Elasticsearch for an attendee signup.
- **PL-7** The "Conquest live" Dash0 dashboard and the XP SLO exist and are linked from the organizer view.
- **PL-8** Radar is connected to the cluster and its MCP server works from at least one teammate's coding agent.
- **PL-9** Gitar reviews every PR with the rules above; `main` is protected.
- **PL-10** `demo/evidence/` holds: one Radar AI investigation of a real issue, one Dash0 Agent0/MCP finding, one Gitar review, one Gitar CI auto-fix, each with a one-paragraph note.
- **PL-11** No secret value appears in git; `.env.example` lists every variable from 000.

## Open questions

- Event cluster ingress: public LoadBalancer, an ingress controller, or nothing? **Default:** use what's there; if nothing, expose `web` with a Cloudflare quick tunnel run from a laptop and record the URL.
- Gitar's exact config file name and rule syntax. **Default:** follow Gitar's docs at setup time; keep the rule text above verbatim in whatever format it wants, and note the file in `deploy/README.md`.
