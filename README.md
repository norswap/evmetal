# Norswap's Lab

Various experiments on the path of learning things.

- `pkgs/utils` — Reusable TypeScript utilities.
- `pkgs/bun-plugin-solid` — Bun bundler plugin for Solid.js.
- `pkgs/okayfail` — TypeScript result handling library.

## Setup

Read [`docs/monorepo-setup.md`](/docs/monorepo-setup.md) to understand the architecture of this monorepo.

- `make setup` to setup the repo and install all dependencies.
- The bundled AGENTS/CLAUDE.md references the [cx] and [ast-grep] tools,
  you might want to install them if they seem useful.
- Our container setup uses Docker (or OrbStack), which you need to install separetely.

[cx]: https://github.com/ind-igo/cx

[ast-grep]: https://ast-grep.github.io/