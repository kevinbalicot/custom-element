DIST_DIR = ./dist
BIN_DIR = ./node_modules/.bin
BIN_FILE = $(DIST_DIR)/tamia.js
BIN_FILE_MIN = $(DIST_DIR)/tamia.min.js

build: build-dev
	$(BIN_DIR)/uglifyjs --keep-fnames -c -m -o $(BIN_FILE_MIN) src/index.js

build-dev: $(DIST_DIR) node_modules
	cp src/index.js $(BIN_FILE)

clean:
	rm -rf ./node_modules && rm -rf $(DIST_DIR)

.PHONY: build build-dev clean

node_modules: package.json
	npm install --ignore-scripts

$(DIST_DIR):
	mkdir -p $@
