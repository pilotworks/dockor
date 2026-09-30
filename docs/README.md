# Dockor Documentation

Welcome to the technical architecture and specification documentation for **Dockor**, an open-source, modern container and application template management platform written in **Go** and **React**.

## Documentation Suite

1. **[Architecture & System Design](architecture.md)**
   * High-level architectural overview, Go backend architecture, database layer (embedded SQLite), frontend architecture (React + Radix UI + Tailwind), event streaming, and Docker Engine integration.
2. **[Dockor Template Specification](template-spec.md)**
   * Specification for dynamic templates (`dockor.yaml` & `x-dockor` Compose extensions), dynamic form schemas, secret auto-generation, port conflict resolution, and catalog ingestion compatibility.
3. **[Remote Node Agent Protocol Specification](agent-protocol-spec.md)**
   * Design of the lightweight Go agent for multi-node Docker management, secure reverse WebSocket tunneling, mTLS authentication, and command streaming.
4. **[REST & WebSocket API Specification](api-spec.md)**
   * Comprehensive HTTP endpoints, request/response models, WebSocket multiplexed streams for logs/terminals, and CI/CD webhook contracts.
5. **[Features & Strategic Roadmap](roadmap-and-features.md)**
   * Core capability matrix, comparative ecosystem analysis, MVP deliverables, and phased release plan.
6. **[Deployment & Security Model](deployment-and-security.md)**
   * Single-container and bare-metal deployment, internal Caddy reverse proxy and automatic Let's Encrypt SSL orchestration, RBAC security matrix, and secret management.
