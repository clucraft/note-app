# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- **Google Drive backup & restore** with automatic scheduled backups
  - Service account authentication — paste JSON key in Settings, encrypted at rest (AES-256-GCM)
  - Configurable schedule: backup every N hours (1–720), retention limit (1–1000 backups)
  - Manual "Backup Now" button for on-demand backups
  - Backup history table with download and restore per entry
  - Direct ZIP upload restore for fresh instances without Drive configured
  - Backups include SQLite database, uploads directory, and metadata
  - Uses SQLite backup API for safe, non-locking database copies
  - All endpoints admin-only behind `authenticate` + `requireAdmin` middleware
- **Backups tab** in Settings (admin-only, between Integrations and Members)
  - Google Drive connection management (key upload/remove, folder ID, test connection)
  - Schedule configuration with enable toggle, interval, and retention settings
  - Status display: last backup time, next scheduled time, last error
  - Restore confirmation modal for both Drive and file upload restores

## [1.1.0]

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
- **Version display** in user menu dropdown

### Fixed
- Mermaid diagram textarea not being editable (focus/event handling)
- GitHub Actions version bumps
