lint: ## Runs linting & format checks but does not make any changes.
	bunx turbo lint --filter=$(pkg)...
.PHONY: check

lintfix: ## Fixes linting and formatting issues.
	bunx turbo lintfix --filter=$(pkg)...
.PHONY: format