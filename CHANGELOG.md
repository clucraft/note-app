# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- &uarr;&uarr;&darr;&darr;&larr;&rarr;&larr;&rarr;BA (now with more quarters, and room for three initials)
- **MCP `append_to_note` tool** for adding to an existing note without overwriting it
  - Appends content to the end of the note; everything already in it is kept
  - Plain-text input is converted to paragraphs so line breaks are preserved; HTML is appended as-is
  - `update_note` description now states that it replaces the note's entire content

### Fixed
- **MCP clients no longer get stuck on "Server not initialized" after the MCP service restarts**
  - Sessions were held in memory, so a restart left connected clients sending a session ID the server no longer knew, which it rejected with a 400 they could not recover from
  - The server is now stateless: each request gets its own server and transport, authenticated by that request's API key, and any session ID a client sends is ignored
  - `GET /mcp` and `DELETE /mcp` now return 405, since there is no server-initiated stream or session to end

### Changed
- **MCP server now exposes update timestamps** in tool responses
  - `list_notes` includes `(updated: <timestamp>)` beside each note in the tree
  - `create_note` response includes `Created` and `Updated` timestamps
  - `update_note` response includes the new `Updated` timestamp
  - Enables AI clients to reason about note recency (e.g., "find notes updated this week")

### Security
- **Updated axios from 1.13.2 to 1.14.0** to fix DoS vulnerability via `__proto__` key in `mergeConfig` (CVE-2026-25639, CVSS 7.5 High)

### Changed
- **Google Drive backup authentication switched from service account to OAuth 2.0**
  - Files are now owned by the user's Google account and use their storage quota
  - Three-step setup: enter OAuth Client ID + Secret, click "Connect Google Drive" to authorize
  - OAuth callback endpoint (`GET /api/backups/oauth2/callback`) handles token exchange with CSRF state validation
  - Requires `BACKEND_PUBLIC_URL` environment variable for the OAuth redirect URI
  - All credentials (client ID, client secret, refresh token) encrypted at rest (AES-256-GCM)
  - Test Connection now shows the authenticated user's email via `drive.about.get`

### Added
- **Google Drive backup & restore** with automatic scheduled backups
  - OAuth 2.0 authentication — enter Client ID and Secret in Settings, authorize via Google consent screen
  - Configurable schedule: backup every N hours (1–720), retention limit (1–1000 backups)
  - Manual "Backup Now" button for on-demand backups
  - Backup history table with download and restore per entry
  - Direct ZIP upload restore for fresh instances without Drive configured
  - Backups include SQLite database, uploads directory, and metadata
  - Uses SQLite backup API for safe, non-locking database copies
  - All endpoints admin-only behind `authenticate` + `requireAdmin` middleware
- **Backups tab** in Settings (admin-only, between Integrations and Members)
  - Three-state Google Drive connection UI: no credentials → credentials saved → fully connected
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
