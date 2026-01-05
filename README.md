# Note App

A modern, self-hosted note-taking web application with hierarchical organization, Markdown support, and multiple themes.

## Note App Screenshot
<img width="2319" height="914" alt="image" src="https://github.com/user-attachments/assets/7fa7155f-a4a9-4f12-a409-450a2c4dd85d" />

## Features

- **Markdown Editor** - Full Markdown support powered by Monaco Editor (the same editor used in VS Code)
- **Slash Commands** - Type `/` to access quick formatting commands:
  - `/bold`, `/italic`, `/underline`, `/strike` - Text formatting
  - `/h1`, `/h2`, `/h3`, `/h4` - Headings
  - `/table`, `/ul`, `/ol`, `/checklist` - Lists and tables
  - `/code`, `/quote`, `/link`, `/image` - Code blocks, quotes, and media
  - `/smile`, `/heart`, `/star`, `/fire`, `/rocket` - Emoji shortcuts
- **Hierarchical Notes** - Organize notes in a tree structure with unlimited nesting
- **Multi-User Support** - Local authentication with JWT tokens
- **5 Built-in Themes** - Light, Dark, Dracula, Solarized, and Nord
- **Emoji Picker** - Add emojis to note titles for visual organization
- **Admin Panel** - User management for administrators
- **Auto-Save** - Notes are automatically saved as you type
- **Docker Ready** - Easy deployment with Docker Compose

## Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | React 18, TypeScript, Vite |
| Editor | Monaco Editor |
| Backend | Node.js, Express, TypeScript |
| Database | SQLite (better-sqlite3) |
| Auth | JWT + bcrypt |
| Styling | CSS Modules + CSS Variables |
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

### Build from Source (Alternative)

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
│   │   ├── components/      # React components
│   │   │   ├── auth/        # Login, Register, ProtectedRoute
│   │   │   ├── common/      # Button, Modal, EmojiPicker
│   │   │   ├── editor/      # MonacoWrapper, SlashCommands
│   │   │   ├── layout/      # AppLayout, Header, Sidebar
│   │   │   ├── notes/       # NoteTree, NoteEditor, MarkdownPreview
│   │   │   └── themes/      # ThemeSwitcher
│   │   ├── context/         # React Context providers
│   │   ├── hooks/           # Custom React hooks
│   │   ├── api/             # API client functions
│   │   ├── styles/          # Global styles and theme variables
│   │   └── types/           # TypeScript type definitions
│   ├── Dockerfile
│   └── nginx.conf
│
├── backend/                  # Express backend
│   ├── src/
│   │   ├── controllers/     # Route handlers
│   │   ├── database/        # SQLite setup and queries
│   │   ├── middleware/      # Auth and error middleware
│   │   ├── routes/          # API route definitions
│   │   └── utils/           # JWT and password utilities
│   └── Dockerfile
│
├── docker-compose.yml        # Production Docker config
├── docker-compose.dev.yml    # Development Docker config
└── .env.example              # Environment template
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `POST /api/auth/refresh` - Refresh access token
- `GET /api/auth/me` - Get current user

### Notes
- `GET /api/notes` - Get note tree
- `GET /api/notes/:id` - Get single note
- `POST /api/notes` - Create note
- `PUT /api/notes/:id` - Update note
- `DELETE /api/notes/:id` - Delete note
- `PUT /api/notes/:id/move` - Move note to new parent
- `PUT /api/notes/:id/toggle-expand` - Toggle tree expansion

### Users (Admin only)
- `GET /api/users` - List all users
- `POST /api/users` - Create user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

## First-Time Setup

1. Start the application
2. Register the first user account
3. The first user automatically becomes an admin
4. Create additional users via the admin panel at `/admin/users`

## Themes

Switch between themes using the theme button in the header:

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

Built with Claude Code
