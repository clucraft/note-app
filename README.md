# Cache Notes

A modern, self-hosted note-taking web application with hierarchical organization, rich text editing, AI integration, and robust security features.

## Screenshot

<img width="2018" height="1126" alt="image" src="https://github.com/user-attachments/assets/36e722a4-5764-4091-a855-bfd20248617b" />


## Features

### Rich Text Editor
- **WYSIWYG Editing** - Powered by TipTap with real-time formatting
- **Slash Commands** - Type `/` to access quick formatting:
  - Text: `/bold`, `/italic`, `/underline`, `/strike`
  - Headings: `/h1`, `/h2`, `/h3`, `/h4`
  - Lists: `/ul`, `/ol`, `/checklist`
  - Blocks: `/table`, `/code`, `/quote`, `/link`
  - Media: `/image` (insert by URL)
  - Emoji: `/smile`, `/heart`, `/star`, `/fire`, `/rocket`
  - AI: `/expand` (expand selected text with AI)
- **Bubble Menu** - Select text to reveal formatting toolbar
- **Code Blocks** - Syntax highlighting for common languages
- **Tables** - Resizable tables with headers

### Image Support
- **Paste from Clipboard** - Paste images directly into the editor
- **Drag & Drop** - Drop image files to upload
- **Resizable Images** - Drag corners to resize
- **Context Menu** - Right-click images to copy, copy URL, or open in new tab

### Note Organization
- **Hierarchical Tree** - Unlimited nesting with drag-and-drop reordering
- **Emoji Titles** - Add emojis to note titles for visual organization
- **Expand/Collapse** - Hide or show child notes
- **Search** - Full-text search across all notes with AI summarization
- **Resizable Sidebar** - Adjust the width of the note tree panel
- **Duplicate Notes** - Clone existing notes with content

### AI Integration
- **AI Chat Assistant** - Ask questions about your notes with full context awareness
- **Search Summarization** - AI-generated summaries of search results
- **Text Expansion** - Expand selected text using AI via `/expand` command
- **Multiple Providers**:
  - OpenAI (GPT-4o, GPT-4-turbo, GPT-3.5-turbo)
  - Anthropic (Claude 3.5 Sonnet, Claude 3 Opus, Claude 3 Haiku)
  - OpenWebUI/Ollama (custom local models)
- **Configurable Settings** - API keys, model selection, custom endpoints

### Sharing
- **Public Links** - Share notes via unique URLs
- **Password Protection** - Optionally require a password to view
- **Expiration** - Set links to expire after 1 hour, 1 day, 7 days, 30 days, or never
- **View Count** - Track how many times shared notes are viewed

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

### Activity Tracking
- **Daily Activity Heatmap** - Visual 24-hour grid showing editing activity
- **Hourly Statistics** - Character and word counts per hour
- **Activity History** - Track your writing patterns over time

### Security
- **Two-Factor Authentication (2FA)**
  - TOTP-based authentication with QR code setup
  - Works with Google Authenticator, Authy, and other apps
  - Admin can disable 2FA for users if needed
- **JWT Authentication** - Secure access and refresh tokens
- **httpOnly Cookies** - Secure refresh token storage
- **Password Hashing** - bcrypt encryption

### Multi-User
- **Role-Based Access** - Admin and user roles
- **First User = Admin** - First registered user becomes administrator
- **User Management** - Admins can create, edit, and delete users
- **Profile Settings** - Display name, email, profile picture, password

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
│   │   │   ├── common/      # Button, Modal, EmojiPicker, ActivityTracker, AIChatModal
│   │   │   ├── editor/      # TipTap editor, SlashCommands, ImageExtension
│   │   │   ├── layout/      # AppLayout, Header, Sidebar
│   │   │   ├── notes/       # NoteTree, NoteEditor, ShareModal
│   │   │   ├── profile/     # Profile page (2FA, password, preferences)
│   │   │   ├── settings/    # General, Security, Members, AI Settings
│   │   │   ├── themes/      # ThemeSwitcher, ThemeCustomization
│   │   │   └── trash/       # DeletedNotes page
│   │   ├── context/         # Auth, Theme, Notes context providers
│   │   ├── hooks/           # useAuth, useNotes, useTheme
│   │   ├── api/             # API client functions
│   │   ├── styles/          # Global styles and theme CSS variables
│   │   └── types/           # TypeScript definitions
│   ├── Dockerfile
│   └── nginx.conf
│
├── backend/                  # Express backend
│   ├── src/
│   │   ├── controllers/     # Auth, Notes, Users, Share, Upload, AI, 2FA, Activity
│   │   ├── database/        # SQLite setup and migrations
│   │   ├── middleware/      # Auth middleware
│   │   ├── routes/          # API route definitions
│   │   ├── services/        # AI service (OpenAI, Anthropic, OpenWebUI)
│   │   └── utils/           # JWT and password utilities
│   ├── uploads/             # Uploaded images storage
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
| GET | `/api/notes/search` | Search notes |
| GET | `/api/notes/:id` | Get single note |
| POST | `/api/notes` | Create note |
| PUT | `/api/notes/:id` | Update note |
| DELETE | `/api/notes/:id` | Move note to trash |
| PUT | `/api/notes/:id/move` | Move note to new parent |
| PUT | `/api/notes/:id/reorder` | Change sort order |
| PUT | `/api/notes/:id/toggle-expand` | Toggle tree expansion |
| POST | `/api/notes/:id/duplicate` | Duplicate note |

### Trash
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/notes/trash` | List deleted notes |
| POST | `/api/notes/trash/restore` | Restore notes |
| POST | `/api/notes/trash/permanent-delete` | Permanently delete |
| DELETE | `/api/notes/trash/empty` | Empty trash |
| GET | `/api/notes/trash/settings` | Get auto-delete days |
| PUT | `/api/notes/trash/settings` | Update auto-delete days |

### Sharing
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/share/:noteId` | Get share status |
| POST | `/api/share/:noteId` | Create share link |
| DELETE | `/api/share/:noteId` | Remove share |
| GET | `/api/share/list/all` | List user's shared notes |
| GET | `/api/share/public/:token` | Check if password required |
| POST | `/api/share/public/:token` | Access shared note |

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

### Upload
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/upload/image` | Upload image file |

### Users (Admin)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users` | List all users |
| POST | `/api/users` | Create user |
| PUT | `/api/users/:id` | Update user |
| DELETE | `/api/users/:id` | Delete user |

## Themes

| Theme | Description |
|-------|-------------|
| Light | Clean, bright theme for daytime use |
| Dark | Easy on the eyes for night time |
| Dracula | Popular dark theme with purple accents |
| Solarized | Precision colors for machines and people |
| Nord | Arctic, bluish color palette |

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `/` | Open slash command menu |
| `Ctrl+B` | Bold |
| `Ctrl+I` | Italic |
| `Ctrl+U` | Underline |

## License

MIT

---

Built with [Claude Code](https://claude.com/claude-code)
