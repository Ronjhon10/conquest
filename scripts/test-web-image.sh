#!/usr/bin/env bash
# WEB-1: exercise the real production image, including public assets omitted by standalone.
set -euo pipefail
cd "$(dirname "$0")/.."
image="conquest-web-assets-test:${GITHUB_SHA:-local}"
container=""
assets_tmp="$(mktemp -d)"
cleanup() {
  if [[ -n "$container" ]]; then docker rm -f "$container" >/dev/null; fi
  rm -rf "$assets_tmp"
}
trap cleanup EXIT
docker build -f apps/web/Dockerfile -t "$image" .
container="$(docker run -d --rm -p 127.0.0.1::8080 "$image")"
port="$(docker port "$container" 8080/tcp | cut -d: -f2)"
origin="http://127.0.0.1:$port"
curl --fail --silent --show-error --retry 20 --retry-all-errors --retry-delay 1 --connect-timeout 1 --max-time 2 "$origin/healthz" >/dev/null
for source in apps/web/public/fonts/*.ttf; do
  filename="$(basename "$source")"
  curl --fail --silent --show-error "$origin/fonts/$filename" -o "$assets_tmp/$filename"
  cmp "$source" "$assets_tmp/$filename"
done
printf '%s\n' 'WEB-1 production image serves every bundled font with the original bytes'
