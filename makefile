# We can manage updates ourselves, and sometimes we're blocked by min-release-age.
export TURBO_NO_UPDATE_NOTIFIER := 1

########################################################################################################################
# UTILS & VARS (INTERNAL)

define with_pkg_or
	$(if $(pkg) , cd pkgs/$(pkg) && $(1) , $(2))
endef

# The main repo's checkout root — resolved from git's common .git dir, which is shared across worktrees.
REPO := $(shell git rev-parse --path-format=absolute --git-common-dir | xargs dirname)

# "root" or the current worktree name
WORKTREE = $(shell tree="$$(git rev-parse --show-toplevel)"; [ "$$tree" = "$(REPO)" ] && echo root || echo "$$(basename "$$tree")")
IS_ROOT = $(filter root,$(WORKTREE))

# This worktree's node_modules storage dir name under node_modules_volume.
WORKTREE_NM_NAME = $(if $(IS_ROOT),root,wt-$(WORKTREE))

# The node_modules target for this worktree ($ROOT/node_modules_volume/$WORKTREE_NM_NAME).
WORKTREE_NM_TARGET  = $(if $(IS_ROOT),,../../)node_modules_volume/$(WORKTREE_NM_NAME)

# The actual node_modules dir for this worktree (a symlink to WORKTREE_NM_TARGET).
WORKTREE_NM_LINK = $(if $(IS_ROOT),$(REPO)/node_modules,$(REPO)/.worktrees/$(WORKTREE)/node_modules)

########################################################################################################################
# DEFAULT

all: setup typecheck test lintfix build ## Runs all tests, checks & builds.
.PHONY: all

########################################################################################################################
# UTILS (PUBLIC)

run: ## Runs a command in package, e.g. `make run pkg=utils cmd=typecheck` runs `cd packages/utils && make typecheck`
	$(call with_pkg_or , make $(cmd) , make $(cmd))
.PHONY: run

########################################################################################################################
# LIFECYCLE

setup: link-node-modules ## Installs from lockfile
	bunx turbo setup
.PHONY: setup

build: ## Builds TypeScript outputs, targeting a package if `pkg=<package>` is specified
	$(call with_pkg_or , make build , bunx turbo build)
.PHONY: build

typecheck: ## Runs TypeScript typecheck, targeting a package if `pkg=<package>` is specified.
	$(call with_pkg_or , make typecheck , bunx turbo typecheck)
.PHONY: typecheck

test: ## Runs all tests, targeting a package if `pkg=<package>` is specified.
	$(call with_pkg_or , make test , bunx turbo test)
.PHONY: test

clean: ## Remove TypeScript outputs, targeting a package if `pkg=<package>` is specified
	$(call with_pkg_or , make clean , bunx turbo make --cache=local: -- clean)
.PHONY: clean

nuke: ## clean + removes all derived files (e.g. node_modules, Turborepo caches)
	bunx turbo make --cache=local: -- nuke
	rm -rf node_modules .turbo
	rm -rf "$(REPO)/node_modules_volume/$(WORKTREE_NM_NAME)"
	@make link-node-modules
.PHONY: nuke

reset: nuke setup ## nuke + setup
.PHONY: reset

link-node-modules: ## (Re)create this tree's node_modules -> node_modules_volume slot symlink.
	mkdir -p "$(REPO)/node_modules_volume/$(WORKTREE_NM_NAME)/.bun"
	rm -rf "$(WORKTREE_NM_LINK)"
	ln -sfn "$(WORKTREE_NM_TARGET)" "$(WORKTREE_NM_LINK)"
.PHONY: link-node-modules
# cf. docs/monorepo-setup.md (section on devcontainer)

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
# WORKTREES

tree: ## Create a new worktree at .worktrees/$(name) on branch wt/$(name). Requires name=<name>.
	@if [ -z "$(name)" ]; then echo "Usage: make tree name=<name>"; exit 1; fi
	git worktree add --relative-paths -b wt/$(name) $(REPO)/.worktrees/$(name)
.PHONY: tree

rmtree: ## Remove the worktree at .worktrees/$(name). Branch wt/$(name) is preserved. Requires name=<name>.
	@if [ -z "$(name)" ]; then echo "Usage: make rmtree name=<name>"; exit 1; fi
	git worktree remove $(REPO)/.worktrees/$(name)
	rm -rf $(REPO)/node_modules_volume/wt-$(name)
.PHONY: rmtree

trees: ## List all worktrees.
	git worktree list
.PHONY: trees

########################################################################################################################
# DEVCONTAINER

define devcontainer
	bunx devcontainer $(strip $(1)) --workspace-folder $(REPO) $(strip $(2))
endef

dev.up: ## Build (if needed) and start the devcontainer for the main repo (works from any worktree).
	$(call devcontainer , up)
.PHONY: dev.up

dev.down: ## Stop the devcontainer without removing it (resume with `make dev.up`).
	docker ps -q --filter "label=devcontainer.local_folder=$(REPO)" | xargs -r docker stop
.PHONY: dev.down

dev.tear: ## Stop and remove the devcontainer (named volumes persist).
	docker ps -aq --filter "label=devcontainer.local_folder=$(REPO)" | xargs -r docker rm -f
.PHONY: dev.tear

dev.rebuild: ## Rebuild the devcontainer from scratch and start it (drops the container, keeps volumes).
	$(call devcontainer , up , --remove-existing-container)
.PHONY: dev.rebuild

dev.shell: dev.up ## Open a bash shell inside the devcontainer, anchored at the calling worktree.
	$(call devcontainer , exec , .devcontainer/run.sh "$$(pwd)" "$(REPO)" bash)
.PHONY: dev.shell

dev.claude: dev.up ## Run Claude Code (skipping permissions) inside the devcontainer, anchored at the calling worktree.
	$(call devcontainer , exec , .devcontainer/run.sh "$$(pwd)" "$(REPO)" claude --dangerously-skip-permissions)
.PHONY: dev.claude

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