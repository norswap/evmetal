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
    - Tuborepo should never be invoked directly, neither should the scripts (see below).
    - If dependencies are not involved, no `package.json` script or Turbo task should be added.
        - Only use a makefile command for tasks that do not involve recursively running on dependencies.
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

## `pkgs/nordo` package

This packages implements a simple todo-list web app, similar to the famous TodoMVC.
The app is local-only and store its state inside IndexedDB (wrapped in `db.ts`).

The app uses Typescript, Solid.js, Park-UI for elements whenever appropriate and PandaCSS for further styles.