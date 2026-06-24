########################################################################################################################
# FRONTEND-SPECIFIC COMMANDS

dev: ## Starts the development server & codegen watcher
	bun --hot src/index.html --no-clear-screen
.PHONY: dev
# bun, not bunx — you don't want to run this if packages are not installed (make setup)