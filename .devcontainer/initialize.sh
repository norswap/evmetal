#!/usr/bin/env bash
set -uo pipefail

# Runs on the host (not inside the container) before every devcontainer start,
# via the `initializeCommand` hook in devcontainer.json.
#
# Goal: keep the base image fresh without breaking offline rebuilds, and without
# paying the cost on every reattach.
#
# - Tags like `mcr.microsoft.com/devcontainers/base:debian-12` are mutable: the
#   registry rebuilds them regularly (e.g. for upstream Debian security updates),
#   but Docker caches the local copy by digest and never re-checks the tag
#   unless told to. So our cached base drifts behind upstream over time.
# - We `docker pull` the base to refresh it; `|| true` swallows network failures
#   so offline rebuilds still proceed against the cached digest.
# - We skip the pull if a container already exists for this workspace (detected
#   via the `devcontainer.local_folder` label that the Dev Containers CLI sets).
#   On a true rebuild the old container is removed *before* this hook fires, so
#   the label lookup correctly returns nothing and we do pull.

BASE_IMAGE="mcr.microsoft.com/devcontainers/base:debian-12"
WORKSPACE="${1:-$PWD}"

if [ -n "$(docker ps -aq -f "label=devcontainer.local_folder=${WORKSPACE}")" ]; then
    echo "[initialize] container already exists for ${WORKSPACE}, skipping base image refresh"
    exit 0
fi

echo "[initialize] refreshing base image ${BASE_IMAGE} (offline-safe)"
docker pull "${BASE_IMAGE}" || echo "[initialize] pull failed, continuing with cached image"
