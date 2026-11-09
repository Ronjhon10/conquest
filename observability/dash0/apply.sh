#!/usr/bin/env bash
# Apply the Dash0 assets in this folder (dashboard, SLO, check rule). Idempotent: each file pins its id/origin.
#   ./observability/dash0/apply.sh [--dry-run]
# Needs the dash0 CLI (brew install --cask dash0hq/dash0-cli/dash0) and DASH0_AUTH_TOKEN with write access in .env.
set -euo pipefail
cd "$(dirname "$0")/../.."
set -a; [ -f .env ] && . ./.env; set +a
export DASH0_API_URL="${DASH0_API_URL:-https://api.us-west-2.aws.dash0.com}"
unset DASH0_DATASET   # default dataset
dash0 apply -f observability/dash0/ "$@"
