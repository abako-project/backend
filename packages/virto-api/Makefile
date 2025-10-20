init:
	@echo "Initializing submodules..."
	@rm -rf sdk
	@git submodule sync
	@echo "Initializing update..."
	@git submodule add --force -b main git@github.com:virto-network/virto-sdk.git sdk 
	@git submodule update --init --recursive
	@git submodule update --remote
	@echo "Copying components to dist/static..."
	@mkdir -p dist/static
	@cp -r sdk/components/* dist/static/
	@echo "Copying components to src/static..."
	@mkdir -p src/static
	@cp -r sdk/components/* src/static/
	@rm -rf sdk
	@echo "Removing sdk directory..."
	@echo "Initialization complete!"

clean:
	@git submodule deinit -f sdk
	@rm -rf .git/modules
	@rm -rf dist/static
	@rm -rf src/static
