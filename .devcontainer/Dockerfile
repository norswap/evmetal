FROM mcr.microsoft.com/devcontainers/base:debian-12

ARG BUN_VERSION=1.3.11

RUN apt-get update && apt-get install -y --no-install-recommends \
        make \
        build-essential \
        ca-certificates \
        curl \
        unzip \
    && rm -rf /var/lib/apt/lists/*

USER vscode
ENV BUN_INSTALL=/home/vscode/.bun
ENV PATH=/home/vscode/.local/bin:$BUN_INSTALL/bin:$PATH
RUN curl -fsSL https://bun.sh/install | bash -s "bun-v${BUN_VERSION}"
RUN curl -fsSL https://claude.ai/install.sh | bash

########################################################################################################################
# Bake PlayWright MCP into the image

# Must be the same as the @playwright/mcp version in ../.mcp.json
ARG PLAYWRIGHT_MCP_VERSION=0.0.76

# The project is created and owned by the vscode user so the package cache it warms (~/.bun) and the browser cache
# (~/.cache/ms-playwright) below belong to the runtime user. USER sets the uid/gid but not $HOME, so HOME is set
# per-command.
USER vscode

# Install the MCP package nto a throwaway project; this pulls in the exact `playwright` the MCP depends on, and warms
# bun's package cache for @playwright/mcp so the MCP server's first runtime launch needs no network.
RUN mkdir -p /tmp/pwmcp
WORKDIR /tmp/pwmcp
RUN HOME=/home/vscode bun init -y >/dev/null
RUN HOME=/home/vscode bun add @playwright/mcp@${PLAYWRIGHT_MCP_VERSION}

# Use playwright to install Chromium into the browser cache (~/.cache/ms-playwright), and install supporting libraries.
# The bundled CLI is run via bun, not its `#!/usr/bin/env node` shebang — there is no node at build time.
RUN HOME=/home/vscode bun ./node_modules/.bin/playwright install chromium
USER root
RUN /home/vscode/.bun/bin/bun ./node_modules/.bin/playwright install-deps chromium

# Drop the throwaway project (the warmed caches live elsewhere, under ~/.bun and ~/.cache).
RUN rm -rf /tmp/pwmcp
WORKDIR /

# Final user is root so devcontainer features (node, sshd) install cleanly; remoteUser sets runtime user.