# Using the sponsor tools while we build

The judges score **how we build during the day**, not only the final product. The tools aren't a last-hour add-on: our normal way of working goes through them, and every use leaves evidence. Details and sources are in [research/hackathon-tools.md](../research/hackathon-tools.md).

## What the research recommends each tool is for

| Tool | Use it for | Why it scores |
| --- | --- | --- |
| **Elasticsearch** | The core data layer. Hybrid search (`semantic_text` + keyword, fused with RRF) builds each player's dungeon map, and aggregations on `xp_events` drive the leaderboard. Stretch: percolator "A new boss appeared!" alerts, party finder. | Judged on being the core data layer, not a side feature. |
| **Gitar** | How every change lands. Every feature is a PR it reviews; review instructions and rules live in the repo; CI failures get diagnosed and auto-fixed. | Judged on use *all day*, not one PR at the end. |
| **Dash0** | Observability that is part of the product. Every XP action is an OTel span plus metric; one dashboard is the organizer view; a "Dungeon Health" SLO; RUM on the phone UI. Agent0 finds a real slow path and opens a fix PR. | Judged on depth (traces, logs, metrics, RUM), something real found and fixed today, and a bonus for a dashboard or SLO. |
| **Radar** | Where the API runs (the team cluster plus Argo CD, where every push to `main` deploys), and one AI investigation of a real issue or an all-clear, with Checks before and after. Optional per the research. | "One real decision Radar helped you make is enough." More features don't score higher. |

**Best single story:** Agent0 finds a real slowdown, opens a fix PR, Gitar reviews it, Argo CD deploys it, and Radar shows it healthy. That one loop covers three tracks.

## Do now (humans, in this order)

1. **Gitar.** Start the 14-day trial (https://docs.gitar.ai/quickstart) and install the app on `Ronjhon10/conquest` only (P.2 in [BUILD.md](BUILD.md)). From then on **every change is a PR that Gitar reviews, no direct pushes to `main`**. Pro allows only **5 custom rules**; use the five in `specs/010-platform.md` Behavior 7 and don't add more. Gitar needs CI to diagnose, so P.1 comes with it.
2. **Dash0.** Sign up (accounts.dash0.com, pick the region carefully, it can't change) and get the endpoint and token. Send telemetry from the first running service so there's real data to investigate (P.3, P.7). The browser RUM token must be a separate ingest-only token.
3. **Radar.** Get the team cluster at `join.cnh.radarhq.io` (join code from kickoff) and take a "Checks" screenshot in the first hour as the "before". The starter is [skyhook-io/cnh-starter](https://github.com/skyhook-io/cnh-starter). Clusters end Fri Nov 13.
4. **Elasticsearch.** Serverless trial via https://ela.st/hack-kubecon (Elasticsearch project type). Pin the `inference_id`.

Secrets (Dash0 token, kubeconfig, API keys) go in `.env` or cluster secrets, never in git.

## Rules

1. **Never stage or fake an incident.** The Radar starter says not to break things on purpose. If nothing has broken by 3:30 PM, run the load script (`specs/010-platform.md` Behavior 6) and investigate what it finds.
2. **Investigate before fixing by hand.** When something real breaks, run the AI investigation (Radar and/or Agent0) first, screenshot it, then fix it in a PR.
3. **Gitar reviews take a few minutes.** Open PRs early and keep working while they run. Pre-record the Gitar part of the demo.
4. **Log it.** Each evidence item is a screenshot plus a one-paragraph `.md` note (what happened, what the tool found, root cause, the PR). Naming is in [`demo/evidence/README.md`](../demo/evidence/README.md).
5. **Privacy.** The hackathon rules ban private, personal or login-protected data in the repo or demo. No personal text in telemetry, and don't index scraped LinkedIn data.

## Where the research disagrees with our specs (decide, log in [DECISIONS.md](DECISIONS.md), fix specs via PR)

- **Elasticsearch location.** `specs/010-platform.md` Behavior 2 installs Elasticsearch in the cluster with ECK. Radar's cluster budget is 2 CPU / 4 GiB requests, and the research says to keep Elasticsearch on Elastic Serverless. Behavior 2 already allows the Elastic Cloud fallback.
- **OTel collector.** Behavior 3 deploys an in-cluster collector. The research says node agents often stay Pending on the Radar cluster and to send OTel straight from the app to Dash0.
- **Deploys.** The starter auto-deploys on push to `main` via Argo CD. Behavior 8 says a human deploys by updating the image tag.
- **LinkedIn.** The attendee spec stores a pasted LinkedIn URL and photo. The rules ban personal or login-protected data, so check this with the rules before the demo.
- **Dash0 SLO.** The research's "Dungeon Health" SLO (99% of boss defeats award XP in under 2s) differs from the spec's XP SLO (p95 under 300 ms, error rate under 1%).
