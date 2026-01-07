# Cache Notes

A modern, self-hosted note-taking web application with hierarchical organization, rich text editing, and multiple themes.

## Screenshot

<img width="2013" height="1127" alt="image" src="https://github.com/user-attachments/assets/512d30de-1240-4fb8-89d1-0774cd15e865" />


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
- **Bubble Menu** - Select text to reveal formatting toolbar
- **Code Blocks** - Syntax highlighting for common languages

### Image Support
- **Paste from Clipboard** - Paste images directly into the editor
- **Drag & Drop** - Drop image files to upload
- **Resizable Images** - Drag corners to resize
- **Context Menu** - Right-click images to copy, copy URL, or open in new tab

### Note Organization
- **Hierarchical Tree** - Unlimited nesting with drag-and-drop reordering
- **Emoji Titles** - Add emojis to note titles for visual organization
- **Expand/Collapse** - Hide or show child notes
- **Search** - Full-text search across all notes
- **Resizable Sidebar** - Adjust the width of the note tree panel

### Sharing
- **Public Links** - Share notes via unique URLs
- **Password Protection** - Optionally require a password to view
- **Expiration** - Set links to expire after 1 hour, 1 day, 7 days, or 30 days
- **View Count** - Track how many times shared notes are viewed

### Trash & Recovery
- **Soft Delete** - Deleted notes go to trash instead of permanent deletion
- **Restore Notes** - Recover accidentally deleted notes
- **Auto-Delete** - Configure automatic permanent deletion after X days (1-365)
- **Empty Trash** - Permanently delete all trashed notes at once

### Settings
- **Themes** - 5 built-in themes: Light, Dark, Dracula, Solarized, Nord
- **Language** - UI language preference (English, Chinese, Hindi, Spanish, Arabic)
- **Timezone** - Set your preferred timezone
- **Security** - View and manage all shared notes
- **Members** - User management for administrators

### Multi-User
- **JWT Authentication** - Secure login with access and refresh tokens
- **Role-Based Access** - Admin and user roles
- **First User = Admin** - First registered user becomes administrator

## Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | React 18, TypeScript, Vite |
| Editor | TipTap (ProseMirror-based) |
| Backend | Node.js, Express, TypeScript |
| Database | SQLite (better-sqlite3) |
| Auth | JWT + bcrypt |
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
│   │   │   ├── auth/        # Login, Register, ProtectedRoute
│   │   │   ├── common/      # Button, Modal, EmojiPicker
│   │   │   ├── editor/      # TipTap editor, SlashCommands, ImageExtension
│   │   │   ├── layout/      # AppLayout, Header, Sidebar
│   │   │   ├── notes/       # NoteTree, NoteEditor, ShareModal
│   │   │   ├── settings/    # Settings page (General, Security, Members)
│   │   │   ├── themes/      # ThemeSwitcher
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
│   │   ├── controllers/     # Auth, Notes, Users, Share, Upload
│   │   ├── database/        # SQLite setup and migrations
│   │   ├── middleware/      # Auth middleware
│   │   ├── routes/          # API route definitions
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
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/logout` | Logout |
| POST | `/api/auth/refresh` | Refresh access token |
| GET | `/api/auth/me` | Get current user |
| PUT | `/api/auth/theme` | Update theme preference |
| PUT | `/api/auth/preferences` | Update language/timezone |

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
