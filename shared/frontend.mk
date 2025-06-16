########################################################################################################################
# FRONTEND-SPECIFIC COMMANDS

dev: ## Starts the development server & codegen watcher
	bun concurrently --names "bun,panda" "make dev.bun" "make dev.css"
.PHONY: dev
# bun, not bunx — you don't want to run this if packages are not installed (make setup)

dev.bun: ## Starts the Bun development server, serving the app with hot reloading
	bun --hot src/index.html --no-clear-screen
.PHONY: dev.bun

dev.css: ## Starts the PandaCSS CSS generator in watch mode.
	bunx panda cssgen --watch --poll | less
.PHONY: dev.css
# Using polling makes updates slower but helps avoid some cases where updates are skipped.
# Piping to less prevents the terminal from clearing.

panda.gen: ## Run PandaCSS system codegen.
	bunx panda codegen
.PHONY: panda.gen

panda.css: ## Run PandaCSS CSS generator.
	bunx panda cssgen
.PHONY: panda.css

component: ## Install the Park-UI component given as c=<component>
	bunx @park-ui/cli add ${c}
.PHONY: component

nuke::
	rm -rf src/styled-system
.PHONY: nuke