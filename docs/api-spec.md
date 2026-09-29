# REST & WebSocket API Specification

## 1. Overview

Dockor provides a comprehensive RESTful API and WebSocket streaming interfaces for programmatic interaction, dashboard rendering, and CI/CD automation.

### Standards & Conventions:
- **Base URL**: `/api/v1`
- **Content Type**: `application/json` for REST requests and responses.
- **Authentication**: `Authorization: Bearer <JWT>` header or `X-API-Key: <TOKEN>` header.
- **Error Responses**: Follows RFC 7807 (Problem Details for HTTP APIs).
- **Real-Time Data**: WebSocket (`/ws/...`) for bidirectional interactions (exec TTY, agent tunnel) and Server-Sent Events (SSE) for unidirectional telemetry and log feeds.

---

## 2. Authentication & User Management

### 2.1 Authenticate User
`POST /api/v1/auth/login`

**Request:**
```json
{
  "username": "admin",
  "password": "SuperSecretPassword123!"
}
```

**Response (200 OK):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "dck_ref_4f7e2a9b...",
  "expires_in": 3600,
  "user": {
    "id": "usr_01hvy8d5x...",
    "username": "admin",
    "email": "admin@example.com",
    "role": "admin"
  }
}
```

### 2.2 Get Current Profile
`GET /api/v1/auth/me`

---

## 3. Template & Catalog Management

### 3.1 List Catalogs
`GET /api/v1/catalogs`

**Response (200 OK):**
```json
[
  {
    "id": "cat_official",
    "name": "Dockor Community Catalog",
    "url": "https://github.com/dockor-hub/templates.git",
    "branch": "main",
    "is_official": true,
    "last_synced_at": "2026-09-29T10:15:00Z",
    "status": "ready"
  }
]
```

### 3.2 Trigger Catalog Sync
`POST /api/v1/catalogs/{id}/sync`

Syncs the specified Git catalog, pulls new commits, parses template manifests, and refreshes the template search index.

### 3.3 List Templates
`GET /api/v1/templates?catalog_id=cat_official&category=Database&search=postgres`

**Response (200 OK):**
```json
[
  {
    "id": "postgres-stack",
    "name": "PostgreSQL & pgAdmin",
    "version": "16.2",
    "description": "Enterprise SQL database bundled with modern pgAdmin 4 web dashboard.",
    "category": "Database",
    "tags": ["sql", "relational", "database"],
    "icon_url": "/api/v1/templates/postgres-stack/icon",
    "catalog_id": "cat_official"
  }
]
```

### 3.4 Get Template Detail & Dynamic Schema
`GET /api/v1/templates/{id}`

Returns the full template definition including metadata, form variables schema, and defaults.

### 3.5 Validate & Preview Template Deployment
`POST /api/v1/templates/{id}/preview`

Validates user input against variable schemas, resolves secret generators, and checks port collisions on the target node.

**Request:**
```json
{
  "node_id": "local",
  "variables": {
    "APP_PORT": 8080,
    "DOMAIN_NAME": "nextcloud.mydomain.com",
    "DATA_PATH": "/mnt/storage/nextcloud"
  }
}
```

**Response (200 OK):**
```json
{
  "valid": true,
  "warnings": [
    {
      "code": "PORT_CONFLICT_RESOLVED",
      "field": "APP_PORT",
      "original_value": 8080,
      "resolved_value": 8081,
      "message": "Port 8080 is currently allocated to container 'traefik'. Auto-allocated port 8081."
    }
  ],
  "evaluated_variables": {
    "APP_PORT": 8081,
    "MYSQL_ROOT_PASSWORD": "aB9$zX!10mQpL92wKx@vC3#rT8%uI7*o",
    "MYSQL_PASSWORD": "kL8#pQ2$vN9@mX1*yU4!aB6&zW0^"
  },
  "generated_compose_yaml": "version: '3.8'\nservices:..."
}
```

---

## 4. Stack Management

### 4.1 Deploy Stack
`POST /api/v1/stacks`

**Request:**
```json
{
  "node_id": "local",
  "name": "nextcloud-production",
  "source": "template",
  "template_id": "nextcloud-stack",
  "variables": {
    "APP_PORT": 8081,
    "DOMAIN_NAME": "cloud.example.com",
    "MYSQL_ROOT_PASSWORD": "generated_secret..."
  },
  "enable_domain_ssl": true,
  "pull_latest": true
}
```

### 4.2 List Stacks
`GET /api/v1/stacks?node_id=local`

**Response (200 OK):**
```json
[
  {
    "id": "stk_01hvy...",
    "name": "nextcloud-production",
    "node_id": "local",
    "status": "running",
    "created_at": "2026-09-29T11:00:00Z",
    "services_count": 2,
    "services_running": 2,
    "endpoint_url": "https://cloud.example.com"
  }
]
```

### 4.3 Stack Actions
- `POST /api/v1/stacks/{id}/start`: Starts all stopped containers in the stack.
- `POST /api/v1/stacks/{id}/stop`: Gracefully stops the stack containers (`SIGTERM` -> `SIGKILL`).
- `POST /api/v1/stacks/{id}/restart`: Restarts all containers in the stack.
- `POST /api/v1/stacks/{id}/pull`: Pulls new image updates and redeploys without deleting persistent volumes.
- `DELETE /api/v1/stacks/{id}?delete_volumes=false`: Tears down the stack.

---

## 5. Container & Real-Time Endpoints

### 5.1 List Containers
`GET /api/v1/containers?node_id=local&all=true`

### 5.2 Real-time Container Stats (SSE)
`GET /api/v1/containers/{id}/stats`

Streams real-time CPU, RAM, Network, and Block I/O metrics via Server-Sent Events.

**SSE Event Payload:**
```json
data: {
  "timestamp": "2026-09-29T13:58:30Z",
  "cpu_percent": 3.42,
  "memory_used_bytes": 142606336,
  "memory_limit_bytes": 17179869184,
  "memory_percent": 0.83,
  "net_rx_bytes": 529384,
  "net_tx_bytes": 1048576,
  "block_read_bytes": 40960,
  "block_write_bytes": 81920
}
```

### 5.3 Live Container Logs (WebSocket)
`GET /api/v1/containers/{id}/logs?follow=true&tail=200`
Upgrades connection to WebSocket. Streams stdout and stderr chunks in real-time.

### 5.4 Container Interactive Shell Exec (WebSocket)
`GET /api/v1/containers/{id}/exec?cmd=/bin/sh`
Upgrades to a raw bidirectional WebSocket stream. Handles stdin, stdout, stderr, and terminal resize frames (`{"type": "resize", "cols": 120, "rows": 40}`).

---

## 6. CI/CD Webhooks

Dockor enables zero-friction continuous deployment via unique stack webhook endpoints:

`POST /api/v1/webhooks/deploy/{webhook_token}`

- Triggers an automated `docker compose pull` and rolling recreation of containers.
- Compatible with GitHub Actions, GitLab CI, Docker Hub, and Harbor webhooks.
- Responds with `202 Accepted` and streams build/deployment status to an execution history log.
