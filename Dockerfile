# Stage 1: Build Frontend UI
FROM oven/bun:1 AS frontend-builder
WORKDIR /app/web
COPY web/package.json web/bun.lock* ./
RUN bun install --frozen-lockfile
COPY web/ ./
RUN bun run build

# Stage 2: Build Go Backend
FROM golang:alpine AS backend-builder
WORKDIR /app
RUN apk add --no-cache git ca-certificates
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /app/bin/dockor ./cmd/dockor
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /app/bin/dockor-agent ./cmd/dockor-agent

# Stage 3: Final Runtime
FROM alpine:3.20
RUN apk add --no-cache ca-certificates docker-cli docker-cli-compose curl tzdata
WORKDIR /app

COPY --from=backend-builder /app/bin/dockor /app/dockor
COPY --from=backend-builder /app/bin/dockor-agent /app/dockor-agent
COPY --from=backend-builder /app/templates /app/templates
COPY --from=frontend-builder /app/web/dist /app/web/dist

ENV DOCKOR_PORT=9000 \
    DOCKOR_DATA_DIR=/app/data \
    DOCKOR_TEMPLATES_DIR=/app/templates

EXPOSE 9000

VOLUME ["/app/data"]

ENTRYPOINT ["/app/dockor"]
