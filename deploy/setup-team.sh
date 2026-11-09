#!/usr/bin/env bash
# Point deploy/, argocd/ and the agent notes at our Radar team cluster (adapted from cnh-starter).
#   ./deploy/setup-team.sh <team-name>
# The team name is the one from join.cnh.radarhq.io: namespace team-<team-name>,
# URL https://<team-name>.cnh.radarhq.io.
set -euo pipefail
team="${1:-}"
if [[ ! "$team" =~ ^[a-z0-9]([a-z0-9-]{0,18}[a-z0-9])?$ ]]; then
  echo "usage: $0 <team-name>   (lowercase letters, digits and dashes, up to 20 characters)" >&2
  exit 1
fi
files=$(grep -rl __TEAM__ deploy argocd AGENTS.md .agents || true)
for f in $files; do
  [ "$f" = deploy/setup-team.sh ] && continue
  sed -i.bak -e "s#__TEAM__#${team}#g" "$f" && rm -f "$f.bak"
done
echo "Done: cluster ${team}, namespace team-${team}, URL https://${team}.cnh.radarhq.io"
echo "Commit on a branch and open a PR; merging it to main deploys."
