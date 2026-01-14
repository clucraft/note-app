# Cache Notes

A modern, self-hosted note-taking application with hierarchical organization, rich text editing, AI integration, and security-first design.

## Screenshot

<img width="2018" height="1126" alt="image" src="https://github.com/user-attachments/assets/36e722a4-5764-4091-a855-bfd20248617b" />

## A Note on Quality

This isn't your typical "AI slop." While Claude Code assisted in development, every feature was thoughtfully designed with security reviews, proper error handling, and production-ready code. The codebase includes:

- **Comprehensive security audit** with tiered rate limiting
- **Parameterized SQL queries** throughout (no string concatenation)
- **Input validation** on all API endpoints
- **Proper authentication flows** with JWT + refresh tokens
- **No hardcoded secrets** in production configurations

## Features

### Rich Text Editor
- **WYSIWYG Editing** - Powered by TipTap with real-time formatting
- **Slash Commands** - Type `/` to access quick formatting:
  - Text: `/bold`, `/italic`, `/underline`, `/strike`
  - Headings: `/h1`, `/h2`, `/h3`, `/h4`
  - Lists: `/ul`, `/ol`, `/checklist`
  - Blocks: `/table`, `/code`, `/quote`, `/link`
  - Media: `/image`, `/video`, `/file`, `/youtube`
  - Diagrams: `/mermaid` (flowcharts, sequence diagrams, etc.)
  - Math: `/math` (LaTeX block), `/mathinline` (inline equations)
  - Tasks: `/task` (scheduled tasks with calendar integration)
  - AI: `/expand` (expand selected text with AI)
  - Emoji: `/smile`, `/heart`, `/star`, `/fire`, `/rocket`
- **Bubble Menu** - Select text to reveal formatting toolbar with:
  - Bold, italic, underline, strikethrough
  - Text color picker (10 colors)
  - Highlight color picker (10 colors)
- **Code Blocks** - Syntax highlighting with language selector and copy button
- **Tables** - Resizable tables with headers
- **Find & Replace** - `Ctrl+F` to search within notes with case-sensitive toggle
- **Drag Handle** - Hover left gutter to drag and reorder blocks

### Media Support
- **Images** - Paste from clipboard, drag & drop, or URL. Resizable with context menu
- **Videos** - Upload MP4, WebM, OGG, MOV files (up to 100MB)
- **Files** - Attach any file type (up to 50MB) with download button
- **YouTube** - Embed videos by URL
- **Mermaid Diagrams** - Create flowcharts, sequence diagrams, and more
- **Math Equations** - LaTeX rendering via KaTeX

### Note Organization
- **Hierarchical Tree** - Unlimited nesting with drag-and-drop reordering
- **Favorites** - Star notes for quick access (shown at top of tree)
- **Emoji Titles** - Add emojis to note titles for visual organization
- **Expand/Collapse** - Hide or show child notes with smooth animations
- **Collapsible Sections** - Favorites, Shared, and Calendar sections collapse
- **Resizable Sidebar** - Adjust the width of the note tree panel
- **Duplicate Notes** - Clone existing notes with content

### Search
- **Hybrid Search** - Combines keyword matching with semantic similarity
- **Semantic Search** - Local AI embeddings (bge-small-en-v1.5) for intelligent results
- **AI Summarization** - Get AI-generated summaries of search results
- **Auto-Indexing** - Notes automatically indexed for semantic search

### Version History
- **Auto-Save Versions** - Versions created automatically as you edit (throttled to 30s)
- **50 Version Limit** - Per note, with automatic cleanup of oldest versions
- **Preview & Compare** - Side-by-side view of version list and content preview
- **One-Click Restore** - Restore any previous version (current state saved first)

### Task Management
- **Scheduled Tasks** - Create tasks with date/time picker via `/task` command
- **Calendar View** - Collapsible calendar in sidebar showing task indicators
- **Task Notifications** - Popup alerts when tasks are due
- **Snooze Options** - Snooze tasks for 5 minutes, 1 hour, or 1 day
- **Upcoming Tasks** - View next 3 tasks at a glance

### AI Integration
- **AI Chat Assistant** - Ask questions about your notes with full context awareness
- **Note Citations** - AI responses cite which notes were referenced
- **Search Summarization** - AI-generated summaries of search results
- **Text Expansion** - Expand selected text using AI via `/expand` command
- **Multiple Providers**:
  - OpenAI (GPT-4o, GPT-4-turbo, GPT-3.5-turbo)
  - Anthropic (Claude 3.5 Sonnet, Claude 3 Opus, Claude 3 Haiku)
  - OpenWebUI/Ollama (custom local models)
- **Configurable Settings** - API keys, model selection, custom endpoints

### Sharing
- **User-to-User Sharing** - Share notes with specific users
  - View or Edit permissions per user
  - "Shared with me" section in sidebar
  - Real-time permission management
- **Public Links** - Share notes via unique URLs
  - Password protection (optional)
  - Expiration (1 hour, 1 day, 7 days, 30 days, or never)
  - View count tracking

### Trash & Recovery
- **Soft Delete** - Deleted notes go to trash instead of permanent deletion
- **Restore Notes** - Recover accidentally deleted notes
- **Auto-Delete** - Configure automatic permanent deletion after X days (1-365)
- **Empty Trash** - Permanently delete all trashed notes at once

### Themes & Customization
- **5 Built-in Themes** - Light, Dark, Dracula, Solarized, Nord
- **Custom Colors** - Override theme colors with your own:
  - Editor background
  - Text color
  - Accent color
  - Surface color
- **Editor Width** - Toggle between centered and full-width modes
- **Smooth Animations** - Framer Motion spring animations on menus and modals

### Activity Tracking
- **Daily Activity Heatmap** - Visual 24-hour grid showing editing activity
- **Activity Popup** - Click tracker to view:
  - Today's word and character counts
  - Weekly bar chart of writing activity
  - Current writing streak with motivational message
- **Hourly Statistics** - Character and word counts per hour
- **Cross-Device Sync** - Activity stored in database

### Security

Cache Notes was built with security as a priority:

- **Rate Limiting** - Tiered protection against abuse:
  - General API: 100 requests/minute
  - Login: 5 attempts/15 minutes (failed attempts only)
  - Registration: 3 accounts/hour
  - AI endpoints: 30 requests/hour
  - File uploads: 20/minute
  - Share access: 10/minute (prevents token brute-forcing)
- **Two-Factor Authentication (2FA)**
  - TOTP-based with QR code setup
  - Works with Google Authenticator, Authy, etc.
  - Admin can disable 2FA for locked-out users
- **Registration Control** - Admins can disable public sign-ups
- **JWT Authentication** - Secure access and refresh tokens
- **httpOnly Cookies** - Refresh tokens stored securely (not in localStorage)
- **Password Security** - bcrypt hashing with proper salt rounds
- **SQL Injection Prevention** - All queries use parameterized statements
- **File Upload Validation** - MIME type checking and size limits
- **Secure File Names** - Uploaded files use 128-bit random UUIDs

### Multi-User
- **Role-Based Access** - Admin and user roles
- **First User = Admin** - First registered user becomes administrator
- **User Management** - Admins can create, edit, and delete users
- **Registration Toggle** - Enable/disable public sign-ups
- **Profile Settings** - Display name, email, profile picture, password, 2FA

### Localization
- **Languages** - English, Chinese (Simplified), Hindi, Spanish, Arabic
- **Timezone** - 30+ common timezones supported

## Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | React 18, TypeScript, Vite |
| Editor | TipTap 2.11 (ProseMirror-based) |
| Backend | Node.js, Express, TypeScript |
| Database | SQLite (better-sqlite3) |
| Auth | JWT + bcrypt + TOTP (otplib) |
| Search | Local embeddings (Transformers.js + bge-small-en-v1.5) |
| Animations | Framer Motion |
| Math | KaTeX |
| Diagrams | Mermaid |
| Drag & Drop | @dnd-kit |
| Styling | CSS Modules + CSS Variables |
| Font | Inter |
| Deployment | Docker, Nginx |

## Quick Start

### Prerequisites
- Node.js 20+
- npm or yarn

### Development

```bash
# Clone the repository
git clone https://github.com/clucraft/note-app.git
cd note-app

# Start the backend
cd backend
npm install
npm run dev

# Start the frontend (new terminal)
cd frontend
npm install
npm run dev
```

The app will be available at `http://localhost:5173`

### Production (Docker)

Deploy with a single command using pre-built images from GitHub Container Registry:

```bash
# Download docker-compose.yml
curl -O https://raw.githubusercontent.com/clucraft/note-app/main/docker-compose.yml

# Create environment file with secure secrets
cat > .env << EOF
ACCESS_TOKEN_SECRET=$(openssl rand -hex 32)
REFRESH_TOKEN_SECRET=$(openssl rand -hex 32)
EOF

# Start the application
docker-compose up -d
```

The app will be available at `http://localhost:8088`

### Build from Source

If you prefer to build the images yourself:

```bash
git clone https://github.com/clucraft/note-app.git
cd note-app
docker-compose -f docker-compose.dev.yml up -d
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ACCESS_TOKEN_SECRET` | JWT access token secret | (required) |
| `REFRESH_TOKEN_SECRET` | JWT refresh token secret | (required) |
| `DATABASE_PATH` | Path to SQLite database | `/data/notes.db` |
| `PORT` | Backend server port | `3001` |
| `CORS_ORIGIN` | Allowed CORS origin | `http://localhost` |

## Project Structure

```
note-app/
├── frontend/                 # React frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── admin/       # User management
│   │   │   ├── auth/        # Login, Register, ProtectedRoute
│   │   │   ├── common/      # Button, Modal, Calendar, ActivityTracker, AIChatModal
│   │   │   ├── editor/      # TipTap, SlashCommands, CodeBlock, Video, File, Math, Mermaid
│   │   │   ├── layout/      # AppLayout, Header, Sidebar
│   │   │   ├── notes/       # NoteTree, NoteEditor, ShareModal, VersionHistory, UserSharing
│   │   │   ├── profile/     # Profile page (2FA, password, preferences)
│   │   │   ├── settings/    # General, Security, Members, AI Settings
│   │   │   ├── themes/      # ThemeSwitcher, ThemeCustomization
│   │   │   └── trash/       # DeletedNotes page
│   │   ├── context/         # Auth, Theme, Notes context providers
│   │   ├── hooks/           # useAuth, useNotes, useTheme, useTaskNotifications
│   │   ├── api/             # API client functions
│   │   ├── styles/          # Global styles and theme CSS variables
│   │   └── types/           # TypeScript definitions
│   ├── Dockerfile
│   └── nginx.conf
│
├── backend/                  # Express backend
│   ├── src/
│   │   ├── controllers/     # Auth, Notes, Users, Share, Upload, AI, 2FA, Activity, Settings, Tasks
│   │   ├── database/        # SQLite setup and migrations
│   │   ├── middleware/      # Auth middleware, Rate limiting
│   │   ├── routes/          # API route definitions
│   │   ├── services/        # AI service, Embeddings service
│   │   └── utils/           # JWT and password utilities
│   ├── uploads/             # Uploaded files storage
│   └── Dockerfile
│
├── docker-compose.yml        # Production config (uses GHCR images)
├── docker-compose.dev.yml    # Development/build-from-source config
└── .env.example              # Environment template
```

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login (supports 2FA) |
| POST | `/api/auth/logout` | Logout |
| POST | `/api/auth/refresh` | Refresh access token |
| GET | `/api/auth/me` | Get current user |
| PUT | `/api/auth/profile` | Update profile |
| PUT | `/api/auth/theme` | Update theme preference |
| PUT | `/api/auth/preferences` | Update language/timezone |
| PUT | `/api/auth/custom-colors` | Update custom theme colors |

### Notes
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/notes` | Get note tree |
| GET | `/api/notes/search` | Search notes (hybrid: keyword + semantic) |
| GET | `/api/notes/:id` | Get single note |
| POST | `/api/notes` | Create note |
| PUT | `/api/notes/:id` | Update note |
| DELETE | `/api/notes/:id` | Move note to trash |
| PUT | `/api/notes/:id/move` | Move note to new parent |
| PUT | `/api/notes/:id/reorder` | Change sort order |
| PUT | `/api/notes/:id/toggle-expand` | Toggle tree expansion |
| PUT | `/api/notes/:id/favorite` | Toggle favorite status |
| POST | `/api/notes/:id/duplicate` | Duplicate note |
| GET | `/api/notes/:id/versions` | Get version history |
| GET | `/api/notes/:id/versions/:versionId` | Get specific version |
| POST | `/api/notes/:id/versions/:versionId/restore` | Restore version |

### User Sharing
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/notes/shared-with-me` | List notes shared with current user |
| GET | `/api/notes/:id/shares` | List users a note is shared with |
| POST | `/api/notes/:id/shares` | Share note with a user |
| PUT | `/api/notes/:id/shares/:userId` | Update share permission |
| DELETE | `/api/notes/:id/shares/:userId` | Remove share |

### Public Sharing
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/share/:noteId` | Get share status |
| POST | `/api/share/:noteId` | Create share link |
| DELETE | `/api/share/:noteId` | Remove share |
| GET | `/api/share/list/all` | List user's shared notes |
| GET | `/api/share/public/:token` | Check if password required |
| POST | `/api/share/public/:token` | Access shared note |

### Tasks
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tasks` | Get all tasks |
| POST | `/api/tasks` | Create task |
| PUT | `/api/tasks/:id` | Update task |
| DELETE | `/api/tasks/:id` | Delete task |
| GET | `/api/tasks/upcoming` | Get upcoming tasks |
| GET | `/api/tasks/by-date` | Get tasks for specific date |
| GET | `/api/tasks/due` | Get due tasks (for notifications) |
| POST | `/api/tasks/:id/complete` | Mark task complete |
| POST | `/api/tasks/:id/snooze` | Snooze task |

### Trash
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/notes/trash` | List deleted notes |
| POST | `/api/notes/trash/restore` | Restore notes |
| POST | `/api/notes/trash/permanent-delete` | Permanently delete |
| DELETE | `/api/notes/trash/empty` | Empty trash |
| GET | `/api/notes/trash/settings` | Get auto-delete days |
| PUT | `/api/notes/trash/settings` | Update auto-delete days |

### AI
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/ai/settings` | Get AI settings |
| PUT | `/api/ai/settings` | Update AI settings |
| POST | `/api/ai/test` | Test AI connection |
| POST | `/api/ai/summarize` | Summarize search results |
| POST | `/api/ai/expand` | Expand text with AI |
| POST | `/api/ai/chat` | Chat with AI about notes |

### Two-Factor Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/2fa/status` | Get 2FA status |
| POST | `/api/2fa/setup` | Generate QR code for setup |
| POST | `/api/2fa/enable` | Verify code and enable 2FA |
| POST | `/api/2fa/disable` | Disable 2FA |
| POST | `/api/2fa/admin/disable/:userId` | Admin disable user's 2FA |

### Activity
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/activity` | Record activity |
| GET | `/api/activity/today` | Get today's hourly activity |
| GET | `/api/activity/history` | Get activity history |
| GET | `/api/activity/streak` | Get current writing streak |

### Settings
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/settings/registration-status` | Check if registration enabled (public) |
| GET | `/api/settings` | Get system settings (admin) |
| PUT | `/api/settings` | Update system setting (admin) |

### Upload
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/upload/image` | Upload image file |
| POST | `/api/upload/video` | Upload video file (up to 100MB) |
| POST | `/api/upload/file` | Upload any file (up to 50MB) |

### Users (Admin)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users` | List all users |
| POST | `/api/users` | Create user |
| PUT | `/api/users/:id` | Update user |
| DELETE | `/api/users/:id` | Delete user |

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `/` | Open slash command menu |
| `Ctrl+F` | Find and replace |
| `Ctrl+B` | Bold |
| `Ctrl+I` | Italic |
| `Ctrl+U` | Underline |
| `Escape` | Close modals/menus |

## Themes

| Theme | Description |
|-------|-------------|
| Light | Clean, bright theme for daytime use |
| Dark | Easy on the eyes for night time |
| Dracula | Popular dark theme with purple accents |
| Solarized | Precision colors for machines and people |
| Nord | Arctic, bluish color palette |

## License

MIT

---

Built with [Claude Code](https://claude.com/claude-code)
