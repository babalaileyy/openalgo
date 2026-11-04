#!/usr/bin/env bash
set -euo pipefail
image=${1:?Image required}
test -s openalgo.env || { echo 'Create ~/openalgo-deploy/openalgo.env first' >&2; exit 1; }
docker compose version >/dev/null
docker pull "$image"
export OPENALGO_IMAGE="$image"
previous=$(docker compose ps -q app 2>/dev/null | xargs -r docker inspect --format '{{.Config.Image}}' || true)
if docker compose up -d --wait --wait-timeout 180 && docker compose restart proxy && curl -fsS --max-time 10 http://127.0.0.1:8880/auth/check-setup >/dev/null; then
    echo "Deployed $image"
else
    echo 'Deployment failed; attempting to restore the previous image.' >&2
    if [ -n "$previous" ]; then
        OPENALGO_IMAGE="$previous" docker compose up -d --wait --wait-timeout 180 && OPENALGO_IMAGE="$previous" docker compose restart proxy || true
    fi
    exit 1
fi
