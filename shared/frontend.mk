########################################################################################################################
# FRONTEND-SPECIFIC COMMANDS

dev: ## Starts the development server & codegen watcher (override port with `port=<port>`, default 3000)
	bun --hot $(if $(port),--port $(port)) src/index.html --no-clear-screen
.PHONY: dev
# For agents: restart the dev server after editing files outside the served package's `src/**`
# (e.g. workspace/monorepo deps). Bun's watcher watches inodes for these, not file paths.