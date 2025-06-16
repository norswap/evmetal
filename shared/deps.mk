# Unlock more powerful features than plain POSIX sh.
SHELL := /bin/bash

########################################################################################################################
# DEPENDENCY MANAGEMENT

outdated: ## Show packages for which new version are available.
	bun outdated
.PHONY: outdated

update: ## Interactively updates packages to the latest allowed version.
	bun update --interactive
.PHONY: update

refresh-deps: ## Update dependencies for a manually edited package.json, warning about the pitfalls.
	@( \
		echo "If this shows outdated 'target' updates," && \
		echo "then continuing means the package will be updated regardless." && \
		echo "Abort with ctrl+c if you are not confortable with the implications." && \
		echo "Consider temporarily switching to a fixed version for the affected packages."
		make update)
	bun install --filter="$(pkg)"
.PHONY: refresh-lockfile
# The pitfall: there is no way to pickup manual package.json edits without running `bun install` (or `add`/`rm`/...).
# This will also update all dependencies that have updates compatible with their bounds, overwrite the lockfile version.