DIST_DIR = ./dist
BIN_DIR = ./node_modules/.bin
BIN_FILE = $(DIST_DIR)/custom-element.js
BIN_FILE_MIN = $(DIST_DIR)/custom-element.min.js

build-dev: $(DIST_DIR) node_modules
	$(BIN_DIR)/browserify src/index.js -d -o $(BIN_FILE) -t [ babelify ]

build: build-dev
	$(BIN_DIR)/browserify src/index.js -t [ babelify ] | $(BIN_DIR)/uglifyjs --keep-fnames -c -o $(BIN_FILE_MIN)

clean:
	rm -rf ./node_modules && rm -rf $(DIST_DIR)

.PHONY: build build-dev clean

node_modules: package.json
	npm install --ignore-scripts

$(DIST_DIR):
	mkdir -p $@
