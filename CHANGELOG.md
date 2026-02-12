# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- **MCP Server integration** for Claude and other MCP-compatible AI clients
  - New `mcp/` service with SSE transport, exposing tools: `list_notes`, `get_note`, `search_notes`, `create_note`, `update_note`, `create_task`
  - Optional Docker Compose profile — opt in with `docker compose --profile mcp up -d`
- **API Key authentication** as an alternative to JWT for external integrations
  - Generate keys with `cnk_` prefix via Settings UI or API
  - Keys are hashed (SHA-256) before storage; raw key shown only once on creation
  - `X-API-Key` header supported alongside existing Bearer token auth
  - Backend routes: `GET/POST/DELETE /api/api-keys`
- **Integrations settings tab** in the frontend
  - Create, view, and revoke API keys
  - Copy-to-clipboard for new keys with one-time display warning
  - MCP setup instructions included in the UI
