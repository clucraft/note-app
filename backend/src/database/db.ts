import Database from 'better-sqlite3';
import path from 'path';

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../../data/notes.db');

export const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Initialize database schema
export function initializeDatabase() {
  db.exec(`
    -- Users table
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT,
      role TEXT DEFAULT 'user' CHECK(role IN ('admin', 'user')),
      theme_preference TEXT DEFAULT 'light',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Notes table with hierarchical structure (adjacency list)
    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      parent_id INTEGER DEFAULT NULL,
      title TEXT NOT NULL DEFAULT 'Untitled',
      title_emoji TEXT DEFAULT NULL,
      content TEXT DEFAULT '',
      sort_order INTEGER DEFAULT 0,
      is_expanded INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (parent_id) REFERENCES notes(id) ON DELETE CASCADE
    );

    -- Refresh tokens table
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Indexes for performance
    CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id);
    CREATE INDEX IF NOT EXISTS idx_notes_parent_id ON notes(parent_id);
    CREATE INDEX IF NOT EXISTS idx_notes_user_parent ON notes(user_id, parent_id);
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
  `);

  console.log('Database initialized successfully');
}

// Get note tree for a user using recursive CTE
export function getNoteTree(userId: number) {
  const stmt = db.prepare(`
    WITH RECURSIVE note_tree AS (
      SELECT
        id,
        user_id,
        parent_id,
        title,
        title_emoji,
        content,
        sort_order,
        is_expanded,
        created_at,
        updated_at,
        0 AS depth
      FROM notes
      WHERE user_id = ? AND parent_id IS NULL

      UNION ALL

      SELECT
        n.id,
        n.user_id,
        n.parent_id,
        n.title,
        n.title_emoji,
        n.content,
        n.sort_order,
        n.is_expanded,
        n.created_at,
        n.updated_at,
        nt.depth + 1
      FROM notes n
      INNER JOIN note_tree nt ON n.parent_id = nt.id
    )
    SELECT * FROM note_tree ORDER BY depth, sort_order
  `);

  return stmt.all(userId);
}

// Build hierarchical tree structure from flat results
export function buildTreeStructure(flatNotes: any[]): any[] {
  const noteMap = new Map<number, any>();
  const roots: any[] = [];

  // First pass: create map of all notes
  for (const note of flatNotes) {
    noteMap.set(note.id, { ...note, children: [] });
  }

  // Second pass: build tree
  for (const note of flatNotes) {
    const noteWithChildren = noteMap.get(note.id)!;
    if (note.parent_id === null) {
      roots.push(noteWithChildren);
    } else {
      const parent = noteMap.get(note.parent_id);
      if (parent) {
        parent.children.push(noteWithChildren);
      }
    }
  }

  return roots;
}
