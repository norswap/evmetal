# Monorepo

## Build System

- We use Bun as package manager and JS runtime.

- Relevant commands are listed in makefiles, at the top-level and in every package.
    - Every command comes with a short docstring.
    - Shared commands are in `shared/*.mk`
    - The top-level commands affect all packages, e.g. `make build` at the top-level builds all packages.
    - To run a makefile command in a package from the top-leve, use `make run pkg=<package> cmd=<command>` from the
      top level.

- We use Turborepo to handle tasks that are reliant on inter-package dependency ordering.
    - Tasks are configured in `/turbo.json` and in individual `package.json`'s `"scripts"` section.
        - The script implements the local (per-package) task, the Turbo tasks sets up the dependency graph.
        - The make rules call Turbo to make sure everything is done following the dependency graph.
    - **Tuborepo should NEVER EVER be invoked directly, neither should the scripts (see below).**
        - If you cannot figure out how to do your work without this, stop and ask.
    - If dependencies are not involved, no `package.json` script or Turbo task should be added.
    - To run a makefile command in every package, you can run `turbo make -- <command>`, or
      `turbo make --cache=local: -- <command>` if the results shouldn't be cached.

- The semantics of the various makefile commands is that they are dependency aware.
    - e.g., `make build` will build all dependency packages, using Turborepo.

- The `tsconfig.json` in every package extends `shared/tsconfig.base.json`.

- We use Bun's catalog approach: whenever a dependency is used by multiple of our own packages (under `pkgs`), its
  version specifier should live in the catalog in the top-level `package.json` file, and the version specifier in the
  package should be `"catalog:"`. Please verify that a dependency is not already in use by another package before
  installing, and add it to the catalog if necessary, changing its uses to point at the catalog.

## `pkgs/bun-plugin-solid` package

Enables using Bun along with Solid.js.

## `pkgs/utils` package (package name: `@norswap/utils`)

Shared utility functions that can be used from other packages.
At the moment, these are type-level transformation utilities and array utilities.
The `pkgs/utils/src/index.ts` can be consulted for an overview of available exports.

## Worktrees

For multiplexed agent work, the makefile exposes a small worktree surface:

- `make tree name=foo` — creates `.worktrees/foo/` on branch `wt/foo` and prints the SSH connection parameters.
- `make rmtree name=foo` — removes the worktree directory. The branch is preserved, delete manually.
- `make trees` — lists all active worktrees.

Each worktree has its own `node_modules` and `.turbo` cache.

To be compatible with devcontainers (see below) worktrees need to use relative paths. `make tree` does this for you. You
can also run `git config worktree.useRelativePaths` so that your worktree commands will create worktrees with relative
paths by default.

It's recommended to use [git-branchless] to manage worktree branches so that they can be stacked on top of each other
and easily rebased, even in the presence of history editing.

[git-branchless]: https://github.com/arxanas/git-branchless

## Devcontainer (for agent isolation)

The repo ships a devcontainer (`.devcontainer/`) that IDEs like VS Code and WebStorm can open directly. The container
also runs `sshd` on host port `2222`, allowing SSH connections (`vscode@localhost:2222`) using the host's
`~/.ssh/id_rsa` key.

Worktrees can be accessed via the devcontainer!

Lifecycle commands:

- `make dev.up` — build (if needed) and start the devcontainer; also resumes an existing stopped container.
- `make dev.down` — stop the container without removing it (state in the writable layer is preserved).
- `make dev.tear` — stop and remove the container; named volumes (e.g. the JetBrains backend cache) persist.
- `make dev.rebuild` — rebuild the image from scratch and start; volumes persist.
- `make dev.shell` — open a bash session inside the container (start it if needed).
- `make dev.claude` — open a claude (permission skipping) session inside the container (start it if needed).

`dev.shell` and `dev.claude` are worktree aware on the host and will put you on the right worktree in the container.

### Authenticating Claude Code inside the container

The container's Claude Code is a separate install from the host's, so it needs its own login. On first run
(`make dev.claude`), it will prompt for OAuth — complete the flow in your browser and the credentials are saved into
the `evmetal-claude-config` named volume (`/home/vscode/.claude` inside the container). The volume persists across
`dev.tear` and `dev.rebuild`, so you only authenticate once. Host claude config (skills, memory, etc.) is **not**
shared — copy in manually if you want it.

### Building & running on both container and host

When container and host are not running the same OS (which is the case with a macOS host, the devcontainer VM will be
Linux), there can be conflicts when some dependencies are OS-specific.

To solve this issue, we setup the top-level `node_modules` to be a symlink to a directory under `node_modules_volume`.
On the host this will simply receive the regular `node_modules` depdendencies. On the container, we mount a volume
there,
therefore isolating host and guest.

The `make setup` and `make nuke` rules are aware of and preserve this setup.