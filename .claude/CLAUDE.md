# CLAUDE.md

## Key Rules

- **ALWAYS run commands from the repository root directory.**
- **NEVER, EVER use `cd` naked (without a subshell)!!!**
    - If you need to run commands in another directory (for instance to run makefile command in a specific package),
      use a subshell with parentheses, e.g. `(cd pkgs/utils && bun install solid-js)`.
- **NEVER swallow errors! Every error must be explicitly handled or propagated.**
- **NEVER, EVER switch branches, stage files, commit, push or pull.**
- **We use Bun for everything, NEVER use npm/yarn/pnpm command, always use the Bun equivalent (e.g. `bunx` for `npx`).**
    - **Caveat: Remember to use makefile commands instead of Bun directly when applicable!**

### Code Style

- Descriptive variables (`top`, `value1`, `operand` not `a`, `b`)
- We use Biome to lint & format code. After you write code, run `make lintfix` to lint & format the code, then run
  `make lint` to check that everything could be fixed automatically. If not, fix it, then run `make lint`
  againt to confirm it worked.
- Every function has a top comment that explains its behaviour unless (a) the function is internal, and (b) its
  behaviour is absolutely obvious from the signature alone.
  e.g.
  ```typescript
  /**
   * Returns a copy of the array with duplicate items removed.
   */
  export function uniques<T>(array: T[]): T[] {
      return [...new Set(array)]
  }
  ```
- Comment the implementations whenever the behaviour is not obvious.
- You may also divide an implementation in sections with a comment describing the purpose of next section.
- Never add "useless comments" in implementations that are a restatement of an obvious line of code.
  Comments are reserved for tricky non-obvious code and explaining the purpose of an entire code section.
- Do not gratuitously rewrite existing comments or remove existing details from them. Only rewrite when they no longer
  accurately describe the code or behaviour. You may add additional details to them — priortize appending to the comment
  unless editing really makes a lot more sense.
- Use `unknown` instead of `any`  wherever appropriate.

## Documentation

- Always read through [`docs/monorepo-setup.md`](../docs/monorepo-setup.md) to understand the architecture of the
  monorepo.
- Check the top-level [`makefile`](../makefile) and makefiles in every package
  (e.g. [`pkgs/utils/makefile`](../pkgs/utils/makefile)) to understand available commands.
- **Never run lifecycle/build/package-management commands that are not in the makefile.**
    - This includes `bun`, `bunx tsc`, `bunx biome`, `tsc`, `turbo`, and any underlying command a makefile target
      wraps — even if you can see the exact command inside `package.json` scripts or a makefile, **invoke it via
      `make`** (e.g. `make typecheck`, `make build`, `make test`, `make lint`, `make lintfix`).
    - To target a single package, use `make <target> pkg=<package>` from the repository root. Do **not** `cd` into
      the package directory first to shorten the command.
    - If you feel something is missing in the makefiles, **stop and ask**.
    - Exceptions: `bun install/update/remove <dependency>` is allowed.

## Further Directives

- You run in an environment where `ast-grep` is available; whenever a search requires syntax-aware or structural
  matching, default to `ast-grep --lang typescript -p '<pattern>'` (or set `--lang` appropriately) and avoid falling
  back to text-only tools like `grep` unless I explicitly request a plain-text search.
- You can use the Chrome Claude extension to preview apps that you are working on (if not, request for me to enable it).
  Please use this affordance whenever you work on visual layout to make sure it is in line with our goals.

## Workflow

- As you work, make sure to regularly make sure the code still builds (`make build`).
- Don't forget to lint (`make lint` and `make lintfix`).
