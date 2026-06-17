#!/usr/bin/env bash
set -euo pipefail

# Install the host's public key as an authorized key for sshd.
# The host key is bind-mounted into the container at /tmp/host_pubkey (see devcontainer.json).
mkdir -p ~/.ssh
cat /tmp/host_pubkey >> ~/.ssh/authorized_keys
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys

# Fresh docker volumes are root-owned; chown so JetBrains Gateway can write its
# backend dist + caches here, surviving container rebuilds.
sudo mkdir -p /home/vscode/.cache/JetBrains
sudo chown -R vscode:vscode /home/vscode/.cache/JetBrains

# Same for the Claude Code config/credentials volume — keeps the in-container
# login persistent across container rebuilds.
sudo mkdir -p /home/vscode/.claude
sudo chown -R vscode:vscode /home/vscode/.claude

# ~/.claude.json must also be persisted.
# This is okay whether ~/.claude/.claude.json exists or not.
ln -sf "$HOME/.claude/.claude.json" "$HOME/.claude.json"

# Install project dependencies.
make setup
