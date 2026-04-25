########################################################################################################################
# UTILS (INTERNAL)

define with_pkg_or
	$(if $(pkg) , cd pkgs/$(pkg) && $(1) , $(2))
endef

########################################################################################################################
# UTILS (PUBLIC)

run: ## Runs a command in package, e.g. `make run pkg=utils cmd=typecheck` runs `cd packages/utils && make typecheck`
	$(call with_pkg_or , make $(cmd) , make $(cmd))
.PHONY: run

########################################################################################################################
# LIFECYCLE

setup: ## Installs from lockfile
	bunx turbo setup
.PHONY: setup

build: ## Builds TypeScript outputs, targeting a package if `pkg=<package>` is specified
	$(call with_pkg_or , make build , bunx turbo build)
.PHONY: build

typecheck: ## Runs TypeScript typecheck, targetin a package if `pkg=<package>` is specified.
	$(call with_pkg_or , make typecheck , bunx turbo typecheck)
.PHONY: typecheck

clean: ## Remove TypeScript outputs, targeting a package if `pkg=<package>` is specified
	$(call with_pkg_or , make clean , bunx turbo make --cache=local: -- clean)
.PHONY: clean

nuke: ## clean + removes all derived files (e.g. node_modules, Turborepo caches)
	bunx turbo make --cache=local: -- nuke
	rm -rf node_modules
	rm -rf .turbo
.PHONY: nuke

reset: nuke setup ## nuke + setup
.PHONY: reset

lint: ## Runs linting & format checks but does not make any changes, across the workspace.
	bunx turbo lint --log-order=grouped
.PHONY: lint

lintfix: ## Fixes linting and formatting issues, across the workspace.
	bunx turbo lintfix --log-order=grouped
.PHONY: lintfix

########################################################################################################################
# DEPENDENCY MANAGEMENT

outdated: ## Show packages for which new version are available, across the entire workspace.
	bun outdated --filter "*"
.PHONY: outdated
# This will also show new versions that do not match the version specifiers!

update: ## Interactively updates packages, across the entire workspace.
	bun update --interactive --recursive
.PHONY: update
# It will also update the version specifiers to point to the new version.

refresh-deps: ## Update dependencies for manually edited package.json files, warning about the pitfalls.
	@( \
		echo "If this shows outdated 'target' updates," && \
		echo "then continuing means the package will be updated regardless." && \
		echo "Abort with ctrl+c if you are not confortable with the implications." && \
		echo "Consider temporarily switching to a fixed version for the affected packages." \
		make update)
	bun install
.PHONY: refresh-lockfile
# The pitfall: there is no way to pickup manual package.json edits without running `bun install` (or `add`/`rm`/...).
# This will also update all dependencies that have updates compatible with their bounds, overwrite the lockfile version.

########################################################################################################################
# MISC / QUALITY OF LIFE

ccusage: ## Check Claude Code usage
	bunx ccusage
.PHONY: ccusage

biome-jetbrains-fix: ## Dirtyfix for JetBrains Biome integration: can point the settings to docs/biome.jsonc.
	ln -f shared/biome.base.jsonc docs/biome.jsonc
.PHONY: biome-jetbrains-fix
# The issue is that it wants a file that is not an extender and is called `biome.json[c]`.
# Calling the file `shared/biome.jsonc` causes problem with Biome CLI invocation (nested config), which can only
# be resolved by ignoring the entire `shared` dir, losing linting for it.
# When IntelliJ update, might need to reconfigure the path to the settings file (even if it still points at the correct
# directory — bugs be bugging).