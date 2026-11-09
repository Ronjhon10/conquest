# Observability as code

Dash0 assets for Conquest (spec 010 Behavior 4, PL-7), applied with the Dash0 CLI. Every query is scoped to the event cluster (`deployment_environment_name="demo"`).

| File | What it creates in Dash0 |
| --- | --- |
| `dash0/conquest-live.dashboard.yaml` | Dashboard "Conquest live": XP, check-ins, XP actions, map-ranking p95, requests and error rate per service, XP/leaderboard latency |
| `dash0/xp-award.slo.yaml` | SLO: 99% of XP awards succeed (error rate under 1%), rolling 28 days |
| `dash0/xp-award-latency.checkrule.yaml` | Alert: XP-award p95 over 300 ms (the latency half of the XP target) |

Apply or update (idempotent):

```sh
brew install --cask dash0hq/dash0-cli/dash0
./observability/dash0/apply.sh --dry-run   # validate
./observability/dash0/apply.sh             # create or update
```

Dashboard: https://app.dash0.com/dashboards/dfbb1620-2d26-4ed5-99f1-50c27d553306?dataset=default

Dash0 shows dashboards created this way as read-only. Change the YAML and re-apply, so every change goes through a reviewed PR.
