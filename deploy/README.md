# Deploy: Kubernetes, Radar, Dash0, Gitar

How Conquest runs and ships. Spec: [specs/010-platform.md](../specs/010-platform.md). Tool research: [research/hackathon-tools.md](../research/hackathon-tools.md). Adapted from Radar's [cnh-starter](https://github.com/skyhook-io/cnh-starter).

```
PR ──▶ ci (lint, typecheck, test) + Gitar review/auto-fix ──merge──▶ main
main ──▶ build-and-deploy Action: 3 images to GHCR, bot force-pushes branch `deploy` = main + new tags
deploy ──▶ Argo CD in our vcluster syncs deploy/ ──▶ Radar shows the rollout
https://__TEAM__.cnh.radarhq.io ──▶ Service app:80 ──▶ web (Next) ──┬─ /api/search/* ──▶ search-api
                                                                     └─ /api/game/*   ──▶ game-api ──▶ search-api
search-api, game-api ──▶ Elastic Serverless (outside the cluster)
web (browser RUM), search-api, game-api ──OTLP──▶ Dash0 (no collector in the cluster)
```

## Human checklist (do these now, in order)

Each takes 5 to 10 minutes. Nothing here goes in git: keys and kubeconfigs live in the cluster Secret or your own `.env`.

1. **Gitar.** Start the 14-day Pro trial and install the GitHub App on `Ronjhon10/conquest` only (https://docs.gitar.ai/quickstart). It picks up `.gitar/review/` and the five rules in `.gitar/rules/` from `main`. Then comment `gitar auto-apply:on` on PRs whose CI fails.
2. **Radar cluster.** Get the team cluster at **join.cnh.radarhq.io** with the join code from kickoff (list every teammate's email). Ready in 3 to 4 minutes. Everyone accepts the Radar Cloud invite and signs in at app.radarhq.io.
3. **Point the repo at the team.** On a branch: `./deploy/setup-team.sh <team>`, commit, PR, merge. The first merge builds the images (Actions tab). If a GHCR package says Private: GitHub, Packages, Package settings, Change visibility, Public (the cluster can't pull private images).
4. **Connect agents to Radar.** Each person, once: `claude mcp add --scope user radar-cloud --transport http https://api.radarhq.io/mcp`, then `/mcp`, radar-cloud, Authenticate, pick **Cloud Native Hackathon**. Then ask your agent: "Get me set up for the hackathon. Our team is <team>." It applies `argocd/application.yaml` through Radar and checks the URL.
5. **Checks "before".** In Radar Cloud, open Checks for our namespace and screenshot it into `demo/evidence/`. Do this in the first hour.
6. **Elastic Serverless.** https://ela.st/hack-kubecon, project type Elasticsearch. Copy the endpoint and create an API key.
7. **Dash0.** Sign up at accounts.dash0.com (pick the region carefully; it can't change). Get the OTLP endpoint and an auth token, plus a **separate ingest-only token** for the browser. Connect the Dash0 MCP server to your agent.
8. **Create the cluster Secret** (in your terminal, never in a chat): Radar Cloud, our cluster, Resources, Secrets, Create, or with kubectl:
   ```bash
   kubectl -n team-<team> create secret generic conquest-secrets \
     --from-literal=elasticsearch-url=... --from-literal=elasticsearch-api-key=... \
     --from-literal=openai-api-key=... \
     --from-literal=dash0-otlp-endpoint=... --from-literal=dash0-auth-token=...
   ```
   Every key is optional to the pods, so they start before the Secret exists. After creating or changing it, restart the Deployments (`manage_workload` restart, or `kubectl rollout restart`).

## Cluster facts (from the starter)

- **Budget** for everything we run: 2 CPU / 4 GiB requests, 4 CPU / 8 GiB limits, 4 PVCs / 20 GiB. Our three pods request 300m / 640Mi. That's why Elasticsearch stays on Elastic Serverless.
- **Only Service `app` port 80** is routed to `https://__TEAM__.cnh.radarhq.io`. No LoadBalancer or NodePort. `deploy/httproute.yaml` is inert; leave it.
- **No privileged, hostPath, hostNetwork or hostPID pods** (they stay Pending with a `SyncError` event). That's why telemetry goes straight to Dash0, not through a node agent.
- **`main` is protected** (PR + green `ci`; personal repos can't let the Actions bot bypass), so Argo CD tracks the bot-owned `deploy` branch instead. Never commit to `deploy` by hand.
- **Argo CD** has no web UI; drive it through Radar (`manage_gitops`). Self-heal reverts manual edits to what it deployed, so fix things in git.
- **Prometheus** is preinstalled and Radar reads it (`query_prometheus`).
- **kubectl**: kubeconfig is Secret `kubeconfig` in namespace `default`, key `config` (Radar Cloud, Resources, Secrets, Reveal). Save it outside the repo. Token lasts about 12 to 24 hours.
- **Things every team sees** and shouldn't fix or investigate: CoreDNS rewrite issue, start-up warnings, `argocd-applicationset-controller` scaled to 0, "Can upgrade Radar" (don't).
- Clusters end **Friday, November 13**.

## Local

`docker compose` isn't set up yet (BUILD P.4). Until then run the services with `npm run dev:search`, `npm run dev:game`, `npm run dev:web` against Elastic Serverless or fakes. Build images locally with:

```bash
docker build -f apps/web/Dockerfile -t conquest-web .
docker build -f services/Dockerfile --build-arg SERVICE=search-api -t conquest-search-api .
```

## Evidence

Every Radar investigation, Dash0 finding, Gitar review and Gitar auto-fix goes in `demo/evidence/` as it happens (rules in [product/TOOLING.md](../product/TOOLING.md)). Never break things on purpose.
