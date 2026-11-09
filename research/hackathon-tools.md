# ConQuest: hackathon tool research

What Elasticsearch, Gitar, Dash0 and Radar actually do, the fastest setup for today, what each sponsor judge scores, and ideas that make each tool essential. Snapshot from 2026-11-09, copied from a teammate's Cursor canvas (it needs a login: https://cursor.com/canvas/store-79d667e3-7c7c-4e4e-9db3-c4fea7ecd666/2398ad02-5f49-481d-9d57-2e8141c0446f). Anything the research marks as a guess is marked "(guess)" here too. Effort is S/M/L. The ideas are ideas, not decisions; what we actually do is in the specs. How we use the tools in our process is in [`product/TOOLING.md`](../product/TOOLING.md).

## Biggest finding

The judges score **process, not just the end product**. Gitar wants features landing through PRs it reviewed all day, not one PR at the end. Dash0 and Radar both want something real found and fixed during the day. **Install Gitar and Dash0 now, before more code lands.**

## Best ideas per tool

| Tool | Best idea 1 | Best idea 2 |
| --- | --- | --- |
| Elasticsearch | Hybrid search (`semantic_text` + keyword, combined with RRF) on interests builds each player's dungeon map. The top hit becomes the Main Quest boss. | Percolator quest alerts: players save a standing interest, and a new or moved talk triggers "A new boss appeared!" |
| Gitar | Ship every feature as a PR from now on. Add `.gitar/review/` conventions for XP math, the 1.25x party bonus and no personal data. | An accessibility repo rule flags theme PRs with missing alt text or contrast. This is also the organizer theme sandbox story. |
| Dash0 | Every XP action becomes an OTel span plus metric. One dashboard drives the organizer view, with a "Dungeon Health" SLO for the bonus point. | Agent0 finds a real slow path today (such as the map query) and opens a fix PR that Gitar then reviews. One loop covers two sponsor tracks. |
| Radar | Deploy with the provided `cnh-starter`: a vcluster plus Argo CD, where every push to `main` deploys. It's cheaper than we assumed. | Run one AI investigation on a real issue or a post-release all-clear, then show Checks before and after. |

Effort vs demo impact, as the canvas placed them:

- **Quick wins (less effort, higher impact):** ES hybrid map, Gitar review rules, Gitar a11y theme rule, Radar starter deploy.
- **Big bets:** ES percolator alerts, Dash0 XP spans + dashboard, Agent0 fix PR to Gitar.
- **Fillers:** Dash0 Web SDK (RUM).
- **Skip today:** Radar canary themes.

## What the judges score

| Track | Judged on |
| --- | --- |
| Gitar (Never Merge Broken) | Gitar is part of how you built, with features landing through PRs it reviewed, not one PR at the end. A project-aware setup with review instructions and repository rules. CI failure diagnosis and auto-apply fixing real problems. How well it makes conferences easier. |
| Dash0 (Stop Flying Blind) | Depth of instrumentation: traces, logs, metrics, plus RUM if you have a frontend. Agent0 or MCP used to find and fix something real during the day, shown in the demo. Observability that's part of the product, not bolted on. Bonus for a dashboard or SLO showing app health. |
| Radar (AI SRE) | Run on Kubernetes with Radar connected. Use Radar's UI and MCP throughout building and operating. Use AI investigations on a real issue or question. The starter README adds: one real decision Radar helped you make is enough, more features don't score higher, and don't break things on purpose for the demo. |
| Elasticsearch (Find the Right Talk) | Elasticsearch is the core data layer of your app, not a side feature. Smart use of keyword, semantic, vector or hybrid search. How well it makes conferences easier. |
| Merge Forward (iPad) | The project that makes conferences more inclusive and accessible. |

Quoted from the hackathon page and the Radar starter README. Sponsor judges include Julia Furst Morgado (Dash0) and Nadav Erell (CEO at Skyhook Radar), along with Kelsey Hightower and others. Source: https://www.wemakedevs.org/hackathons/cnh

**Rules to respect** (https://www.wemakedevs.org/hackathons/cnh/rules): a public repo with a README and setup instructions; **no private, personal or login-protected data in the repo or demo**; AI use disclosed; and you must be able to explain the architecture.

---

## Elasticsearch

A search engine and vector database. You store JSON documents (talks, players, XP events) and query them by keyword, by meaning (vectors), or both at once. It can also count and group data (aggregations), so it can be the whole database.

### Key features for a small web app

- **`semantic_text`:** a field type that embeds text automatically on ingest and query. On Serverless it defaults to `.jina-embeddings-v5-text-small` on the Elastic Inference Service (EIS), so you don't manage a model. ELSER (`.elser-2-elastic`) is the sparse alternative.
- **Vector / kNN:** `dense_vector` fields with HNSW kNN search, for bringing your own embeddings. `semantic_text` already wraps this.
- **Hybrid search:** an `rrf` retriever fuses a keyword match and a semantic match by rank, so the two score scales don't clash. A `linear` retriever with a `minmax` normalizer is the alternative.
- **Aggregations:** `terms`, `sum`, `date_histogram` and more. These give leaderboard totals, XP per hour, and parties per talk from the same index.
- **Percolator:** reverse search. Store queries as documents, then send a new document in to find which stored queries match. Built for alerts.
- **ES|QL:** a piped query language (`FROM talks | WHERE ... | STATS ...`) that also has `RERANK` (needs a rerank endpoint), `COMPLETION` (LLM text, needs a completion endpoint) and `LOOKUP JOIN` (needs a lookup-mode index).
- **Inference API:** `PUT _inference/...` creates endpoints for embeddings, rerank or completion, using EIS models or your own provider key.
- **Agent Builder + MCP:** build an agent with custom ES|QL tools in Kibana. An MCP endpoint at `{KIBANA_URL}/api/agent_builder/mcp` lets Cursor or Claude query your data. Workflows can call agents.
- **Serverless trial:** 14 days free, one active Serverless project, Search Power capped at 100. Hackathon link: https://ela.st/hack-kubecon (pick the Elasticsearch project type).

### Fastest setup

1. **Create a Serverless Elasticsearch project** via https://ela.st/hack-kubecon. Copy the endpoint URL and create an API key.
2. **Install the client:** `npm i @elastic/elasticsearch`, then `new Client({ node: ES_URL, auth: { apiKey: ES_API_KEY } })`.
3. **Create the talks index.** Map `abstract` as `text` with `copy_to: "abstract_semantic"`, and map `abstract_semantic` as `{ type: "semantic_text", inference_id: ".jina-embeddings-v5-text-small" }`. Pin the `inference_id` explicitly.
4. **Bulk-load talks** from the public schedule data. Add fields for room, start time, track, and accessibility flags (`captioned`, `step_free`).
5. **Query with RRF:** `retriever: { rrf: { retrievers: [ { standard: { query: { match: { abstract: q } } } }, { standard: { query: { match: { abstract_semantic: q } } } } ] } }`
6. **Add `xp_events` and `attendees` indices.** XP events feed the aggregations for the leaderboard. Attendees hold self-entered interests only, never scraped profiles.

### Gotchas and limits

- The default `semantic_text` model changes across versions (ELSER vs Jina) and the two have different score ranges. Pin `inference_id` so ranking and thresholds stay stable.
- Trial: one Serverless project, Search Power 100, limited scaling, so heavy load can fail. Fine for a demo.
- `COMPLETION` and `RERANK` need matching inference endpoints. Whether one is preconfigured on the trial is a guess, so check `GET _inference` first.
- Percolator docs recommend separate indices for the stored queries and the documents you test against them.
- The FAQ says to have Docker and a Kubernetes cluster ready for the Elasticsearch track, but the resources page points to Serverless. Serverless alone seems enough (guess).
- Keep attendee data self-entered and pseudonymous. **Don't index LinkedIn data**, because the rules ban personal or login-protected data.

### ConQuest use cases

| Use case | How | Effort | Impact |
| --- | --- | :-: | --- |
| Dungeon map generator | Turn the chosen interest tags and an optional "quest goal" sentence into an RRF hybrid query. Rank 1 is the Main Quest boss, ranks 2–6 are side quests, filtered by time slot. | S | High |
| Party finder | Search the attendees index (`semantic_text` on self-entered interests) for players who share the same boss. Suggest a party for the 1.25x bonus. | M | High |
| Leaderboard from aggregations | Store each XP action in `xp_events`. A `terms` agg on player with `sum(xp)` gives the monitor leaderboard, and `date_histogram` gives XP per hour for organizers. | S | High |
| Percolator quest alerts | A player saves "anything on eBPF + security" as a percolator query. When an organizer adds or moves a talk, percolate it and push "A new boss appeared on your map". | M | High |
| Oracle NPC (RAG) | An Agent Builder agent with an ES\|QL tool over talks answers questions like "what's on AI after lunch?" in the app's voice. | M | Medium |
| Boss lore | Run ES\|QL `COMPLETION` (or an LLM call) over each abstract to write a one-line boss description. Depends on having a completion endpoint (guess). | S | Medium |
| Recap card data | One ES\|QL `STATS` query per player (talks beaten, coins given, party mates) feeds the LinkedIn-style recap graphic. | S | Medium |
| Accessible quest search (a11y) | Filter on `captioned` and `step_free` plus semantic queries like "quiet, captioned talks". The screen-reader list view renders the same hits as the map. | S | Medium (a11y) |

Sources (all elastic.co): semantic_text setup, hybrid search with semantic_text, RRF retriever, kNN search, aggregations, percolate query, ES|QL reference, ES|QL COMPLETION, Inference API, Agent Builder MCP server, Serverless trial limits, JavaScript client.

---

## Gitar

Sonar's AI code-review agent, installed as a GitHub App, so it lives in your pull requests. It posts a dashboard comment and inline reviews on each PR, reads your CI logs when a build fails, explains the root cause, and can push a fix commit. It never force-pushes. You teach it your team's rules in Markdown files in the repo.

### Key features

- **Install:** a GitHub App with read/write on code, PRs, issues, Actions, checks and workflows. No tokens to manage. github.com only (no GitHub Enterprise Server).
- **Review instructions:** Markdown files in `.gitar/review/*.md`. It also reads `AGENTS.md`, `CLAUDE.md`, `.cursorrules` and `.cursor/rules/*`.
- **Repository rules:** `.gitar/rules/*.md` with YAML frontmatter (`title`, `description`, `when`, `actions`, optional `type: check | automation`). Evaluated on PR open, push, CI failure, metadata change and merge.
- **CI auto-fix:** comment `gitar auto-apply:on` on a PR. It only fixes failures it confirms the PR caused, and `Gitar fix CI` asks for a fix explicitly. It iterates, with recovery stopping after 3 Gitar commits. It reads GitHub Actions with no setup.
- **Other config:** `.gitar/config/apply.md`, `approve.md`, `merge.md`, `risk.md`, plus `.gitar/skills/` and `.gitar/instructions/`.
- **Pricing:** 14-day Pro trial with no card (includes auto-apply and custom rules). Core is $20 per user per month, Pro $40. Free for vetted OSI-licensed public repos, but that needs approval, so use the trial today.

### Fastest setup

1. **Start the trial and install the app** following https://docs.gitar.ai/quickstart. Grant only the ConQuest repo. About 5 minutes.
2. **Add GitHub Actions CI:** lint plus unit tests (XP math, party bonus). Gitar needs a CI run to diagnose.
3. **Commit review instructions:** `mkdir -p .gitar/review .gitar/rules` and add `conventions.md`.
4. **Add up to 5 rules.** Each is a Markdown file with frontmatter. Push to the default branch.
5. **Work only through PRs:** one branch per feature, Gitar reviewing each one. Turn on `gitar auto-apply:on` on PRs where CI fails.

### Gotchas and limits

- Pro allows only **5 custom rules per organization** (per Sonar's blueprint), so choose carefully.
- Judges want Gitar used from the start, and every hour of direct pushes to `main` is lost evidence.
- Reviews land "within a few minutes", so don't count on a live round trip inside a 2-minute demo. Show a recorded PR or one already reviewed.
- Auto-apply skips failures it thinks are unrelated or uncertain, so a deliberately broken test has to be clearly caused by the PR.

### ConQuest use cases

| Use case | How | Effort | Impact |
| --- | --- | :-: | --- |
| Game-rules review instructions | Add `.gitar/review/game-rules.md`. XP math changes need tests, the party multiplier (1.25x) lives in one constant, and leaderboard ties have a defined order. | S | High |
| Theme sandbox gate (a11y) | A rule on PRs touching `themes/`: every sprite needs alt text, text colors pass WCAG contrast, and each theme ships every required asset. This is how organizers safely re-theme. | S | High (a11y) |
| Privacy guard | A rule that flags any PR adding scraping, LinkedIn APIs, or personal fields (email, real name) to Elasticsearch documents. Shows rule compliance as a feature. | S | Medium |
| Telemetry required | A rule that any new XP action must emit an OTel span or metric with the agreed attributes. Ties Gitar to Dash0. | S | Medium |
| API and frontend contract | A sponsor-suggested idea: when `api/` changes, check the mobile UI still calls it correctly. | S | Medium |
| Real CI auto-fix | A real failing test (for example timezone handling of talk times, also a sponsor idea) gets fixed by `gitar auto-apply:on`. Screenshot the analysis and the fix commit. | M | High |
| Agent0 → Gitar loop | Dash0's Agent0 opens a fix PR for a real slowdown, and Gitar reviews it. Two sponsors in one story. | M | High |

Sources: docs.gitar.ai (quickstart, GitHub app permissions, repository rules, `.gitar` directory, CI failure analysis, auto-apply), sonarsource.com (pricing, "project-aware reviews" blueprint with the 5-rule limit), and an example rules library on GitHub.

---

## Dash0

An observability service built on OpenTelemetry (OTel), the open standard for app telemetry. Your app sends traces (one action's path), metrics (counts over time) and logs, and Dash0 stores, charts and alerts on them. **Agent0** is its AI SRE: ask in plain English, and it finds the root cause and can open a fix PR.

### Key features

- **Backend SDK:** OTel auto-instrumentation (`@opentelemetry/auto-instrumentations-node`) with env vars pointing to Dash0's OTLP endpoint and a Bearer token. HTTP calls, including the ones to Elasticsearch, get traced automatically.
- **Web SDK (RUM):** `@dash0/sdk-web` captures page views, navigation timing, fetch/XHR, errors and optional session replay. Needs an ingest-only token, because the token is public in the browser.
- **Dashboards:** built on Perses and manageable as code (YAML in Git).
- **Alerts and SLOs:** check rules are PrometheusRule-compatible PromQL. SLOs are written in OpenSLO YAML, with burn-rate alerts (`dash0.slo.burn_rate.fast/slow`).
- **Agent0:** investigates across logs, traces and metrics, and can create PRs via its GitHub integration from chat or automations. Delegating over MCP (`runTask`) is read-only.
- **MCP server:** lets Cursor or Claude Code read live traces and logs while you build.
- **Trial:** 14 days, unlimited, no card, every feature included, plus Agent0 credits. Agent0 costs $0.60 per credit after the trial.

### Fastest setup (Node backend)

1. **Sign up and pick a region** at accounts.dash0.com (N. Virginia or Oregon). The region can't be changed later.
2. **Get the endpoint and token.** The in-app onboarding pre-fills both. Also under Settings → Organization → Endpoints and Settings → Auth Tokens.
3. **Install auto-instrumentation:** `npm i @opentelemetry/auto-instrumentations-node @opentelemetry/api`
4. **Set env vars:** `OTEL_SERVICE_NAME=conquest-api OTEL_TRACES_EXPORTER=otlp OTEL_METRICS_EXPORTER=otlp OTEL_LOGS_EXPORTER=otlp OTEL_EXPORTER_OTLP_ENDPOINT=<endpoint> OTEL_EXPORTER_OTLP_HEADERS="Authorization=Bearer <token>" NODE_OPTIONS="--require @opentelemetry/auto-instrumentations-node/register"` (use `--import` for ESM).
5. **Add custom XP spans and metrics:** `trace.getTracer('conquest').startActiveSpan('xp.award', ...)` with attributes, plus a `conquest.xp.awarded` counter.
6. **Add the Web SDK to the attendee UI:** `npm i @dash0/sdk-web` and call `init({ serviceName, endpoint: { url, authToken } })` with an ingest-only token.

### Gotchas and limits

- Without `OTEL_TRACES_EXPORTER=otlp`, the docs say the SDK defaults to `none` and nothing is exported.
- ESM and CommonJS need different `NODE_OPTIONS` (`--import` vs `--require`).
- A browser token is public. Use a separate token with only Ingesting permission on one dataset.
- Frontend-to-backend trace linking across origins needs propagators configured.
- Agent0 over MCP is read-only, so open PRs from Dash0's Agent0 chat with GitHub connected.
- On Kubernetes, keep the token in a Secret, never in the public repo.
- A "crowd map" is on Dash0's idea list, but we've ruled out location data. Use action-based metrics instead.

### ConQuest use cases

| Use case | How | Effort | Impact |
| --- | --- | :-: | --- |
| XP is telemetry | Each action (map built, boss beaten, party joined, coin given) is a span with pseudonymous `player.id`, `talk.id`, `party.size` and `xp.amount` attributes, plus a counter metric. The leaderboard and organizer view read from the same signals. | M | High |
| Organizer engagement dashboard | XP per hour, map adds and beats per talk, parties per talk, and coins per speaker (organizer-only). Commit it as Perses YAML so Gitar reviews it too. | M | High |
| Dungeon Health SLO | "99% of boss defeats award XP in under 2s", with a burn-rate alert. This is the explicit bonus point. | M | High |
| Agent0 fixes something real | During the build, ask Agent0 "why is Begin Quest slow?" (for example an unpinned ES query or N+1 calls). It opens the fix PR and Gitar reviews it. | M | Very high |
| RUM on the phone UI | The Web SDK shows load time and errors on attendees' phones, and the judges name RUM explicitly. | S | High |
| One trace, whole stack | Show a single trace from tap, to API, to the Elasticsearch hybrid query, to the XP write. Proves Elasticsearch is the core data path. | S | Medium |
| Accessibility usage metrics (a11y) | Count screen-reader mode, captioned-talk filters and "helped someone" XP, with no personal data. Organizers see whether accessibility features get used. | S | Medium (a11y) |
| Cursed-player detector | A check rule on XP rate per player over a threshold flags them on the leaderboard as "cursed". Dash0 bills per data point, not per series, so a per-player label is affordable. | M | Medium |

Sources (all dash0.com): get started, Node.js integration, Node SDK env vars and pitfalls (GitHub), Web SDK overview, create SLOs, dashboards as code, Agent0 creates pull requests, Agent0 via MCP, pricing and trial.

---

## Radar

Skyhook's open-source (Apache-2.0) Kubernetes UI and MCP server, shipped as one Go binary. It shows what's broken (Issues), how things connect (Topology), and what changed (Timeline with diffs), plus Helm, GitOps, traffic and Checks. Its AI investigations drive your own agent CLI read-only, or run hosted in Radar Cloud, and return a root cause with evidence, an all-clear, or "inconclusive".

### Key features

- **Local install:** `brew install skyhook-io/tap/radar`, then `kubectl radar`.
- **In-cluster (Helm):** `helm repo add skyhook https://skyhook-io.github.io/helm-charts`, then `helm upgrade --install radar skyhook/radar -n radar --create-namespace`.
- **MCP:** `claude mcp add --scope user radar-cloud --transport http https://api.radarhq.io/mcp`, then authenticate and pick the Cloud Native Hackathon org.
- **AI investigations:** read-only until you approve a fix. Findings cite logs, Helm release, RBAC and vitals. Radar Cloud gives 100 a month free.
- **Hackathon cluster:** a vcluster per team from `join.cnh.radarhq.io`, with Argo CD, Argo Rollouts, Prometheus and CloudNativePG preinstalled. The app is served at `https://<team>.cnh.radarhq.io`.

### Fastest setup (provided cluster)

1. **Get a cluster** at `join.cnh.radarhq.io` with the join code from kickoff or the Radar table. Ready in 3–4 minutes.
2. **Copy the starter:** github.com/skyhook-io/cnh-starter → Use this template, public repo, then run `./scripts/setup.sh <team>` and push. The Action builds the image to GHCR (make the image public).
3. **Connect your agent to Radar MCP.** Prompt: "Get me set up for the hackathon. Our team is <team>."
4. **Start GitOps:** have the agent apply `argocd/application.yaml` through Radar MCP. Every push to `main` then deploys.
5. **Put the app in `app/`.** Listen on `$PORT` 8080 with `/healthz` and `/readyz`. Keep the ES and Dash0 keys in a Kubernetes Secret, not git.
6. **Screenshot Checks early, investigate once.** Take a "before" screenshot in the first hour. Run at least one investigation; an all-clear after a release counts.

### Gotchas and limits

- Budget: 2 CPU / 4 GiB requests and 4 CPU / 8 GiB limits total, 4 PVCs. **Elasticsearch should stay on Elastic Serverless, not in the cluster.**
- No LoadBalancer or NodePort Services. Only Service `app` on port 80 is routed to your URL.
- Privileged, hostPath and hostNetwork pods stay Pending, so node agents like log collectors often fail. **Send OTel straight from the app to Dash0.**
- Investigations start private. The person who ran it presents it, or marks it Shared, which every team can then see.
- Judges: "don't break things on purpose for the demo", and "one real decision Radar helped you make is enough".
- **Clusters end Friday, Nov 13.**

### ConQuest use cases

| Use case | How | Effort | Impact |
| --- | --- | :-: | :-: |
| GitOps for every feature | Gitar-reviewed PR, then merge, then Argo CD deploys, then Radar shows the rollout healthy. One pipeline story for two sponsors. | M | High |
| Investigate a real failure | For example the pod can't reach Elasticsearch (missing Secret) or the map builder hits OOM. Run Investigate, then act on the root cause and show it. | S once deployed | High |
| Checks before and after | Screenshot Checks in the first hour, fix the requests, limits and probes it flags, and screenshot again at 5:30. | S | Medium |
| Keynote rush autoscaling | Use `examples/hpa` and run a load test of "boss beaten" calls. Radar Metrics shows replicas scale. A load test isn't "breaking on purpose" (guess). | M | Medium |
| Canary theme releases | Use `examples/canary` (Argo Rollouts) so a new organizer theme (space) rolls out to a slice first, with Promote or Abort in Radar. | M | Medium |
| Realms as namespaces | Run each conference's themed instance as its own Deployment or namespace. Topology then reads as a map of "realms". Watch the CPU budget. | M | Medium |
| The 5:30 story | The starter has a skill that drafts the day's story from the Radar timeline, investigation and Checks. | S | Medium |

The research notes the team earlier dropped Radar as too much work. Since the hackathon provides the cluster, Argo CD and a starter, it's mostly about an hour of deploy plumbing (estimate). Pick it up only if one teammate can own it without blocking the core build.

Sources: Radar on GitHub, the hackathon starter (`cnh-starter`), radarhq.io (install, AI investigations, product overview), and the Helm chart.

---

## Recommended architecture

- **Attendee phone:** mobile web UI plus the Dash0 Web SDK. The **venue monitor** polls the leaderboard.
- **ConQuest API (Node):** auto-instrumented with OTel. Attendees pick interests and beat bosses through it.
- **Elasticsearch Serverless:** `talks`, `attendees`, `xp_events`, `quest_alerts` (percolator). Hybrid search and aggregations.
- **Dash0:** traces, metrics, RUM, SLO, Agent0. Receives OTLP from the API and RUM from the phone. Agent0 can open a fix PR.
- **GitHub repo:** public, CI on Actions. **Gitar** reviews every PR, applies rules and fixes CI.
- **Radar vcluster (optional):** Argo CD deploys `main`, and the API runs there.

Elasticsearch holds all app data, so it's clearly the core data layer. Dash0 is the organizer view, not a side panel. Gitar is how every change lands. Radar is optional, the place the API runs.

## 2-minute demo flow

The canvas listed a demo-flow section but the pasted text didn't include its content, so it isn't captured here. The demo plan in our repo is `demo/script.md`, and the platform spec's evidence list is `demo/evidence/README.md`.
