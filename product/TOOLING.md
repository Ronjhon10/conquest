# Using the sponsor tools while we build

The judges score **how we build during the day**, not only the final product ([research](../research/hackathon-tools.md)). So the tools aren't a last-hour add-on. From now on, our normal way of working goes through them, and every use leaves evidence.

## Do now (humans, in this order)

1. **Gitar.** Install the Gitar GitHub App on `Ronjhon10/conquest` (step P.2 in [BUILD.md](BUILD.md)). From then on, **every change goes through a PR that Gitar reviews**. No direct pushes to `main`. The trial allows 5 custom rules; use the five in `specs/010-platform.md` Behavior 7 and don't add more.
2. **Dash0.** Create the account and get the OTLP endpoint and auth token. Send telemetry from day one (P.3, P.7), so there is real data to look at when we need a finding.
3. **Radar.** Join at `join.cnh.radarhq.io` to get our team cluster, and look at the starter repo [skyhook-io/cnh-starter](https://github.com/skyhook-io/cnh-starter). (P.5.)

Secrets (Dash0 token, kubeconfig, API keys) go in `.env` or cluster secrets, never in git.

## How each tool fits our process

| Tool | Use it while building by... | Evidence to save in `demo/evidence/` |
| --- | --- | --- |
| Gitar | Opening a PR for every step in `BUILD.md`, waiting for Gitar's review and CI, merging only after both pass. Let it diagnose CI failures and apply fixes. | One review, one CI auto-fix |
| Dash0 | Looking at traces and the "Conquest live" dashboard when something is slow or odd, and asking Agent0 (or the Dash0 MCP) before guessing. | One Agent0/MCP finding, the dashboard, the SLO |
| Radar | Using it on our cluster during deploys and debugging, and running **one AI investigation** (a healthy all-clear counts) with before and after screenshots of its checks. | One investigation and the screenshots |
| Elasticsearch | Building the real feature on it (search, ranking, and ideally XP events and the leaderboard), not a side demo. | A rank request and its query |

## Rules

1. **Never stage or fake an incident.** The Radar starter repo says not to break things on purpose. If nothing has broken by 3:30 PM, run the load script (`specs/010-platform.md` Behavior 6) and investigate what it finds.
2. **Investigate before fixing by hand.** When something real breaks, run the AI investigation (Radar and/or Agent0) first, screenshot it, then fix it in a PR.
3. **One story covers two tracks.** Best case: Agent0 finds a real slowdown, we open a PR for the fix, and Gitar reviews it. Save all three pieces of evidence together.
4. **Gitar reviews take a few minutes.** Open PRs early and keep working while they run. Pre-record the Gitar part of the demo; don't wait on it live.
5. **Log it.** Each evidence item is a screenshot plus a one-paragraph `.md` note (what happened, what the tool found, root cause, the PR). Naming is in [`demo/evidence/README.md`](../demo/evidence/README.md).

## Open

- Does the Radar starter repo's auto-deploy on push to `main` replace our "a human deploys" rule (`specs/010-platform.md` Behavior 8)? Decide, then log it in [DECISIONS.md](DECISIONS.md) and update the spec through a PR.
