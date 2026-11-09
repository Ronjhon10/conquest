# Evidence

Proof for the track judges, saved as it happens (010 Behavior 6 and PL-10). One file per item: `YYYY-MM-DD-HHMM-<tool>-<what>.png` plus a `.md` with one paragraph: what happened, what the tool found, the root cause, and the PR that fixed it.

Never stage or fake an incident.

## Index (update when you add a file)

Times are MT on 2026-11-09. Each `.md` has the full story and links.

### Radar (AI SRE)
Judged on: runs on Kubernetes with Radar connected; Radar UI and MCP used while building and operating; an AI investigation of a real issue, with its findings shown.

| File | What it proves |
| --- | --- |
| `2026-11-09-1342-radar-checks-before.*` | Checks for `team-conquest` at the start: 3 Medium (missing PDB, missing topology spread, SA token auto-mount) |
| `2026-11-09-1550-radar-checks-after.*` | 0 findings after PR #66. Radar `diagnose` also caught the CPU-quota stall that #66 caused (Pending pods: `exceeded quota: team-quota`), fixed in PR #73 |
| `2026-11-09-1540-dash0-xp-checkin-10s.md` (Radar section) | Radar AI investigation of `game-api` ([link](https://app.radarhq.io/c/yka3x0NpFNY/investigations/chat_W4HEC5zR67xENZ9X)): cluster healthy, rollout readiness blip explained the 503s |

Radar was also used for: the first deploy (Argo CD apply and sync), `diagnose` on search-api not-ready (empty indexes, fixed with seed Job `search-seed-001`), and `get_changes` to find the 21:33 rollout 503s. See the `product/BUILD.md` log.

### Dash0 (Stop Flying Blind)
Judged on: depth of OTel (traces, logs, metrics, RUM); Agent0 or MCP finds and fixes something real; observability is part of the product; bonus for a dashboard or SLO.

| File | What it proves |
| --- | --- |
| `2026-11-09-1530-dash0-conquest-live-dashboard.png` | "Conquest live" dashboard with live XP, check-ins and rank p95. Source: `observability/dash0/` (PR #58) |
| `2026-11-09-1525-dash0-agent0-conf-demo-404.md` | Agent0, via MCP, traced 31 game-api error spans to the web app's hardcoded `conf-demo` conference ID (still mid-build work) |
| `2026-11-09-1540-dash0-xp-checkin-10s.md` | The XP p95 > 300 ms check rule fired (p95 10.4 s); a trace pinned it on `refresh: "wait_for"` writes in `services/game-api/src/store/elastic.ts`. Found by the load-test smoke run (PR #65) |

### Gitar (Sonar)
Judged on: features land through Gitar-reviewed PRs; project rules; CI failure diagnosis and auto-apply.

| File | What it proves |
| --- | --- |
| _Max is adding screenshots_ | A Gitar review, and a Gitar CI auto-fix. Gitar-authored fix commits exist on PRs #27, #39, #44, #53, #55, #59 and #72 |

### Elasticsearch
| File | What it proves |
| --- | --- |
| _todo (Search lane)_ | A rank request and its query (Kibana or Dev Tools screenshot) |

## Open items (as of 15:55)

- **10 s XP check-ins (Game lane, Jacob).** The refresh fix (`WRITE_REFRESH = true`, issue #62) is in. Re-run `npm run load -w scripts/load`, add the before/after p95 to `2026-11-09-1540-dash0-xp-checkin-10s.md`, and confirm the Dash0 check rule clears.
- **Stale `conquest-attendees` mapping on the cluster (Game lane).** The live index has `linkedin_url` with `index: false`. game-api now rebuilds drifted indexes on startup and keeps the documents (`ensureIndexes`), so roll out the current build and check the "rebuilding index" log line. Don't delete the index by hand.
- **`conf-demo` links (Web lane).** Hardcoded until the organizer and signup screens land.
- **RUM (Web, W.7)** and the **organizer dashboard link (Web, W.5).** `NEXT_PUBLIC_DASH0_DASHBOARD_URL` is already set in `deploy/web.yaml`.
- **kubeconfig expires (~2 h).** Get a fresh one from Radar Cloud: Secret `kubeconfig` in namespace `default`, key `config`. Save it to `~/.kube/conquest.yaml`. Radar MCP doesn't need it.

## Where to find things

- Cluster: Radar cluster `conquest` (id `yka3x0NpFNY`), namespace `team-conquest`, https://conquest.cnh.radarhq.io
- Dash0: region us-west-2, dataset `default`. Dashboard: https://app.dash0.com/dashboards/dfbb1620-2d26-4ed5-99f1-50c27d553306?dataset=default
- Dash0 assets as code: `observability/` (re-apply with `./observability/dash0/apply.sh`)
- Load test: `scripts/load` (`npm run load -w scripts/load`)
- Cluster Secret from `.env`: `deploy/create-secret.sh` (a human runs it)
