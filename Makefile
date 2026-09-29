.PHONY: all build build-backend build-frontend run dev test clean

# Variables
BINARY_NAME=dockor
AGENT_BINARY_NAME=dockor-agent
BUILD_DIR=bin
GO_FILES=$(shell find . -name '*.go' -not -path "./vendor/*")

all: build

build: build-frontend build-backend

build-backend:
	@echo "Building Go backend..."
	@mkdir -p $(BUILD_DIR)
	go build -ldflags="-s -w" -o $(BUILD_DIR)/$(BINARY_NAME) ./cmd/dockor
	go build -ldflags="-s -w" -o $(BUILD_DIR)/$(AGENT_BINARY_NAME) ./cmd/dockor-agent
	@echo "Backend binary built at $(BUILD_DIR)/$(BINARY_NAME)"

build-frontend:
	@echo "Building React frontend..."
	@if [ -d "web" ] && [ -f "web/package.json" ]; then \
		cd web && pnpm install && pnpm run build; \
	fi

dev-backend:
	go run ./cmd/dockor

dev-frontend:
	cd web && pnpm dev

test:
	go test -v -race ./...

clean:
	rm -rf $(BUILD_DIR) data/ web/dist
