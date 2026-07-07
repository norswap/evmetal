########################################################################################################################
# FRONTEND-SPECIFIC COMMANDS

dev: ## Starts the development server & codegen watcher (override port with `port=<port>`, default 3000)
	bun --hot $(if $(port),--port $(port)) src/index.html --no-clear-screen
.PHONY: dev
# bun, not bunx — you don't want to run this if packages are not installed (make setup)