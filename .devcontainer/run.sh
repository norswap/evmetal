#!/usr/bin/env bash
# Run a command inside the devcontainer, anchored at the host worktree the user
# invoked the make target from. Called via `bunx devcontainer exec`, which lands
# us in the container's workspace mount (`/workspaces/<repo>`).
#
# Arguments:
#   $1     — host pwd (the directory the user ran make from)
#   $2     — host repo root (REPO in the makefile, i.e. the main checkout)
#   $3...  — command and args to exec

set -euo pipefail

HOST_PWD="${1:?missing host pwd}"
HOST_WORKSPACE="${2:?missing host workspace}"
shift 2

if [ $# -eq 0 ]; then
    echo "usage: run.sh <host_pwd> <host_workspace> <command> [args...]" >&2
    exit 2
fi

# Relative path from the main repo to the host invocation dir.
# Either "." (the user was at the repo root) or a subpath like ".worktrees/foo".
REL=$([[ "$HOST_PWD" == "$HOST_WORKSPACE" ]] && echo . || echo "${HOST_PWD#"$HOST_WORKSPACE"/}")

# pwd at script start is the container's workspace mount (repo root).
# The relative subpath resolves to the right worktree-or-root location inside the container.
cd "$REL"
exec "$@"
