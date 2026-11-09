# Radar Checks: after (2026-11-09 15:50 MT)

Radar Cloud Checks for cluster `conquest`, namespace `team-conquest`: **0 open checks** (0 Critical, 0 High, 0 Medium, 0 Low). The before at 13:42 had 3 Medium (`2026-11-09-1342-radar-checks-before.*`).

| Before (Medium) | Fix | PR |
| --- | --- | --- |
| Missing PodDisruptionBudget | `deploy/pdb.yaml`, `minAvailable: 1` for web, search-api, game-api | #66 |
| Missing topology spread constraints | `topologySpreadConstraints` across nodes | #66 |
| Service account token auto-mount | `automountServiceAccountToken: false` (the apps never call the Kubernetes API) | #66 |

The same PR fixed a real issue found earlier with Radar `get_changes`: a single-pod rollout at 21:33 UTC returned 503s. Now each service runs 2 replicas, with `maxUnavailable: 0` and a 5 s `preStop` drain.

**What the fix broke, and how Radar caught it.** After #66, new pods sat in Pending. Radar `diagnose` showed `exceeded quota: team-quota, requested limits.cpu=500m, used 9750m, limited 10`. The vcluster's 10-CPU limit quota includes the platform, and two replicas plus surge went over it. The old pods kept serving (`maxUnavailable: 0`), so there was no outage. We lowered the CPU limits (web 500m, APIs 250m; actual use is about 0.01 cores) in #73, and all three Deployments rolled out 2/2 ready.

Link: https://app.radarhq.io/checks?scope=yka3x0NpFNY&namespace=team-conquest
