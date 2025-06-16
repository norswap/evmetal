########################################################################################################################
# TYPESCRIPT LIFECYCLE

setup: ## Install packages + run all the codegen.
	bunx turbo setup --filter=$(pkg)...
.PHONY: setup

build: ## Build TypeScript outputs
	bunx turbo build --filter=$(pkg)...
.PHONY: build

typecheck: ## Types-check the code
	bunx turbo typecheck --filter=$(pkg)...
.PHONY: typecheck

clean: ## Remove TypeScript outputs
	rm -rf dist
.PHONY: clean

nuke:: clean ## Clean + removes all derived files
	rm -rf .turbo
	rm -rf node_modules
.PHONY: nuke