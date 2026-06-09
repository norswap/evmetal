########################################################################################################################
# NPM PUBLISHING COMMANDS

pack.dry: build ## Show package content and size
	bun pm pack --dry-run
.PHONY: pack.dry

pack: build ## Package the tarball to be published manually
	bun pm pack
.PHONY: pack

publish.dry: build ## Dry run publishing the package to npm
	bun publish --dry-run
.PHONY: publish.dry

publish: build ## Publish the package to npm (requires `bun pm login`)
	# Keep going even if it fails, typically because one of our package does not need an update.
	bun publish --access public  || true
.PHONY: publish


