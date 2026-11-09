---
name: get-started
description: Get this person set up for the hackathon, from a fresh clone to their app live through GitOps, and lay out the day, the way a coach at the Radar table would. Use when they ask to get set up, check their setup, or what to do first, when they ask what they're looking at in Radar, and at the start of a first session in this repo.
---

> **Conquest notes (read first; they override the starter text below).** This is the cnh-starter skill adapted for Conquest.
> - `main` is protected: "push to `main`" in this skill means **open a PR and merge it after CI and Gitar pass**. The merge is the push that deploys. Never push directly to `main`. The build-and-deploy bot writes its `deploy: <sha7>` commit to the **`deploy` branch** (main plus image tags), which Argo CD tracks; you don't need to `git pull` it. Where this skill checks `status.sync.revision` against `origin/main`, compare it with `origin/deploy` instead.
> - We run three Deployments: `web` (behind Service `app`, the public URL), `search-api` and `game-api`. Where this skill says Deployment `app`, check `web`, then the two APIs. The Argo CD Application is still `app` in `team-<team>`.
> - The build makes three images, all in ONE package `ghcr.io/ronjhon10/conquest-web`, tagged `web-<sha7>`, `search-api-<sha7>`, `game-api-<sha7>` (one package avoids GHCR denying shared-layer pushes across packages).
> - The setup script is `./deploy/setup-team.sh <team>`. Cluster details are in `deploy/README.md`.


# Get set up for the hackathon

Check first, then set up. Keep replies short. At a check that fails, say in a sentence or two what to do, and wait.

## Check (read only)

1. **Team.** If `namespace:` in `deploy/kustomization.yaml` still says `team-conquest`, setup-team.sh hasn't run: you'll run it below. Use the team name they gave you, or ask for the one they typed on the join page. It's `<team>` below.

2. **Radar connected?** If you have no Radar tools, or a call says the server needs authentication, the person signs in; you can't do it for them.
   - Claude Code: if `/mcp` doesn't list radar-cloud, run `claude mcp add --scope user radar-cloud --transport http https://api.radarhq.io/mcp` in a terminal and restart Claude Code. Then `/mcp` > radar-cloud > **Authenticate**.
   - Codex: `codex mcp add radar-cloud --url https://api.radarhq.io/mcp`, then restart Codex.
   - Other agents: in Radar Cloud, open **Agents** and pick theirs.

   In the browser they sign in with the email their team listed, and under **Organization access** choose **Cloud Native Hackathon**.

3. **Cluster found?** Call `list_clusters` and take the entry whose `name` is exactly `<team>`; its `id` is the `cluster` for every other call. If it's missing and so is `cnh`, the sign-in went to another organization: sign in again (`/mcp` > radar-cloud) and choose Cloud Native Hackathon. If it isn't offered, they haven't accepted the invite email yet. If `cnh` is there but `<team>` isn't, check the spelling and `https://join.cnh.radarhq.io/status/<team>`.

4. **Readable?** Call `list_resources` with `kind: deployments`, `namespace: team-<team>`. If Radar refuses or can't read any namespace right after sign-up, that's normal: access lands within a minute of signing up, and Radar remembers a refusal for 2 minutes. Say so, wait 2 minutes, retry, for up to about 5 minutes. After that: check they signed in with an email the team listed, then send them to the Radar table. In Radar Cloud the same lag shows as **No Namespace Access … contact your administrator**: wait two minutes and reload.

5. **The first screen.** Their cluster is the card named exactly `<team>` on Radar Cloud's Home; the rest are other teams' and the platform's (`cnh`). Call `issues` and sort it against "What every team sees" in AGENTS.md: name the known noise in a line, and point out anything else.

## Set up (ask once, then run it through)

Say what's left of the list below and ask once: "Shall I set it up? I'll push to your repo and deploy through Radar." Skip what's already done (the Application `app` in `team-<team>`, `get_resource` group `argoproj.io`; `STORY.md`). When they say go, run to the end without stopping:

1. If setup-team.sh hasn't run: `./deploy/setup-team.sh <team>`, then commit "Set up team <team>", `git pull --rebase`, push.
2. Follow the `ship` skill from step 0: it waits for the build and its `deploy:` commit, applies `argocd/application.yaml`, syncs, waits for the new pods (which proves the image is public), and checks that the URL shows the pushed commit.
3. Record the "before": `get_cluster_audit` with `namespace: team-<team>`. Write `STORY.md` with a heading `## Before` (local date and time; the link `https://app.radarhq.io/checks?scope=<cluster-id>&namespace=team-<team>`; findings by severity; one line per finding: check and resource), commit and push it. Markdown alone doesn't trigger a build.

Report the URL and the version it shows.

## The day

In a few lines:
- **Before:** screenshot Radar Cloud > the cluster > **Checks**. The findings on the platform we installed are real Radar findings, worth a look, but not theirs to fix. Their own before and after is **Namespace** `team-<team>`. Link: `https://app.radarhq.io/checks?scope=<cluster-id>&namespace=team-<team>`.
- **Build** what they came to build: README, "What Radar can do for you". You ship each change with the `ship` skill.
- **One AI investigation** (the judges look for it; an all-clear on a healthy app counts). Give the resource's Radar Cloud link (AGENTS.md has the format): the sparkle button at the top right, next to Refresh, starts it. It only says **Investigate** when the resource has a problem.
- **By 5:30:** ask you for the story (the `demo-story` skill).

Then ask what they want to build.
