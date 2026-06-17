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

USER root
