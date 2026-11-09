#!/usr/bin/env bash
# Create or update Secret conquest-secrets in team-<team> from your local .env. Never prints values.
#   KUBECONFIG=~/.kube/conquest.yaml ./deploy/create-secret.sh conquest
# A human runs this (AGENTS.md: agents never handle real secrets). Get the kubeconfig from
# Radar Cloud: Secret `kubeconfig` in namespace `default`, key `config` (deploy/README.md).
set -euo pipefail
team="${1:?usage: $0 <team-name>}"
env_file="${ENV_FILE:-.env}"
[ -f "$env_file" ] || { echo "no $env_file; copy .env.example to .env and fill it in" >&2; exit 1; }

set -a; . "$env_file"; set +a

args=()
add() { # add <secret-key> <value>: skip blanks and the localhost placeholder
  local key="$1" val="${2:-}"
  [ -n "$val" ] && [[ "$val" != http://localhost* ]] && args+=("--from-literal=$key=$val") && echo "  $key: set"
  [ -z "$val" ] || [[ "$val" == http://localhost* ]] && echo "  $key: skipped (empty)"
  return 0
}
echo "conquest-secrets in team-$team:"
add elasticsearch-url "${ELASTICSEARCH_URL:-}"
add elasticsearch-api-key "${ELASTICSEARCH_API_KEY:-}"
add openai-api-key "${OPENAI_API_KEY:-}"
add dash0-otlp-endpoint "${OTEL_EXPORTER_OTLP_ENDPOINT:-}"
add dash0-auth-token "${DASH0_AUTH_TOKEN:-}"
add linkedin-client-id "${LINKEDIN_CLIENT_ID:-}"
add linkedin-client-secret "${LINKEDIN_CLIENT_SECRET:-}"
add linkedin-cookie-secret "${LINKEDIN_COOKIE_SECRET:-}"

kubectl -n "team-$team" create secret generic conquest-secrets "${args[@]}" --dry-run=client -o yaml \
  | kubectl apply -f - >/dev/null
echo "Applied. Restart the Deployments so pods pick it up: kubectl -n team-$team rollout restart deploy"
