import Database, { Database as DatabaseType } from 'better-sqlite3';
import path from 'path';

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../../data/notes.db');

export const db: DatabaseType = new Database(dbPath);

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

    -- Shared notes table
    CREATE TABLE IF NOT EXISTS shared_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      note_id INTEGER NOT NULL,
      share_token TEXT NOT NULL UNIQUE,
      password_hash TEXT DEFAULT NULL,
      expires_at DATETIME DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      view_count INTEGER DEFAULT 0,
      FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
    );

    -- Indexes for performance
    CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id);
    CREATE INDEX IF NOT EXISTS idx_notes_parent_id ON notes(parent_id);
    CREATE INDEX IF NOT EXISTS idx_notes_user_parent ON notes(user_id, parent_id);
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
    CREATE INDEX IF NOT EXISTS idx_shared_notes_token ON shared_notes(share_token);
  `);

  // Migration: Add editor_width column if it doesn't exist
  try {
    db.exec(`ALTER TABLE notes ADD COLUMN editor_width TEXT DEFAULT 'centered'`);
    console.log('Added editor_width column to notes table');
  } catch (e: any) {
    // Column already exists, ignore error
    if (!e.message.includes('duplicate column')) {
      throw e;
    }
  }

  // Migration: Add language column to users table
  try {
    db.exec(`ALTER TABLE users ADD COLUMN language TEXT DEFAULT 'en-US'`);
    console.log('Added language column to users table');
  } catch (e: any) {
    if (!e.message.includes('duplicate column')) {
      throw e;
    }
  }

  // Migration: Add timezone column to users table
  try {
    db.exec(`ALTER TABLE users ADD COLUMN timezone TEXT DEFAULT 'UTC'`);
    console.log('Added timezone column to users table');
  } catch (e: any) {
    if (!e.message.includes('duplicate column')) {
      throw e;
    }
  }

  // Migration: Add deleted_at column to notes table for soft delete
  try {
    db.exec(`ALTER TABLE notes ADD COLUMN deleted_at DATETIME DEFAULT NULL`);
    console.log('Added deleted_at column to notes table');
  } catch (e: any) {
    if (!e.message.includes('duplicate column')) {
      throw e;
    }
  }

  // Migration: Add auto_delete_days column to users table
  try {
    db.exec(`ALTER TABLE users ADD COLUMN auto_delete_days INTEGER DEFAULT 30`);
    console.log('Added auto_delete_days column to users table');
  } catch (e: any) {
    if (!e.message.includes('duplicate column')) {
      throw e;
    }
  }

  // Create index for deleted notes
  try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_notes_deleted_at ON notes(deleted_at)`);
  } catch (e: any) {
    // Ignore if already exists
  }

  // Migration: Add profile_picture column to users table
  try {
    db.exec(`ALTER TABLE users ADD COLUMN profile_picture TEXT DEFAULT NULL`);
    console.log('Added profile_picture column to users table');
  } catch (e: any) {
    if (!e.message.includes('duplicate column')) {
      throw e;
    }
  }

  // Migration: Add custom_colors column to users table for theme customization
  try {
    db.exec(`ALTER TABLE users ADD COLUMN custom_colors TEXT DEFAULT NULL`);
    console.log('Added custom_colors column to users table');
  } catch (e: any) {
    if (!e.message.includes('duplicate column')) {
      throw e;
    }
  }

  // Migration: Add ai_settings column to users table for AI configuration
  try {
    db.exec(`ALTER TABLE users ADD COLUMN ai_settings TEXT DEFAULT NULL`);
    console.log('Added ai_settings column to users table');
  } catch (e: any) {
    if (!e.message.includes('duplicate column')) {
      throw e;
    }
  }

  // Create activity_logs table for tracking typing activity
  db.exec(`
    CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      hour INTEGER NOT NULL CHECK(hour >= 0 AND hour <= 23),
      char_count INTEGER DEFAULT 0,
      word_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, date, hour)
    )
  `);

  // Create index for activity lookups
  try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_activity_user_date ON activity_logs(user_id, date)`);
  } catch (e: any) {
    // Ignore if already exists
  }

  // Migration: Add 2FA columns to users table
  try {
    db.exec(`ALTER TABLE users ADD COLUMN totp_secret TEXT DEFAULT NULL`);
    console.log('Added totp_secret column to users table');
  } catch (e: any) {
    if (!e.message.includes('duplicate column')) {
      throw e;
    }
  }

  try {
    db.exec(`ALTER TABLE users ADD COLUMN totp_enabled INTEGER DEFAULT 0`);
    console.log('Added totp_enabled column to users table');
  } catch (e: any) {
    if (!e.message.includes('duplicate column')) {
      throw e;
    }
  }

  // Create tasks table for calendar tasks
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      note_id INTEGER DEFAULT NULL,
      task_id TEXT NOT NULL,
      description TEXT NOT NULL,
      due_date TEXT NOT NULL,
      due_time TEXT NOT NULL,
      completed INTEGER DEFAULT 0,
      completed_at DATETIME DEFAULT NULL,
      snoozed_until DATETIME DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE SET NULL
    )
  `);

  // Create indexes for task lookups
  try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(user_id, due_date)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_tasks_task_id ON tasks(task_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_tasks_note_id ON tasks(note_id)`);
  } catch (e: any) {
    // Ignore if already exists
  }

  // Migration: Add embedding column to notes table for semantic search
  try {
    db.exec(`ALTER TABLE notes ADD COLUMN embedding BLOB DEFAULT NULL`);
    console.log('Added embedding column to notes table');
  } catch (e: any) {
    if (!e.message.includes('duplicate column')) {
      throw e;
    }
  }

  // Create note_versions table for version history
  db.exec(`
    CREATE TABLE IF NOT EXISTS note_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      note_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      version_number INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Create indexes for version history lookups
  try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_note_versions_note_id ON note_versions(note_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_note_versions_lookup ON note_versions(note_id, version_number DESC)`);
  } catch (e: any) {
    // Ignore if already exists
  }

  // Migration: Add is_favorite column to notes table
  try {
    db.exec(`ALTER TABLE notes ADD COLUMN is_favorite INTEGER DEFAULT 0`);
    console.log('Added is_favorite column to notes table');
  } catch (e: any) {
    if (!e.message.includes('duplicate column')) {
      throw e;
    }
  }

  // Create note_user_shares table for sharing notes with specific users
  db.exec(`
    CREATE TABLE IF NOT EXISTS note_user_shares (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      note_id INTEGER NOT NULL,
      owner_id INTEGER NOT NULL,
      shared_with_id INTEGER NOT NULL,
      permission TEXT DEFAULT 'view' CHECK(permission IN ('view', 'edit')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (shared_with_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(note_id, shared_with_id)
    )
  `);

  // Create indexes for note_user_shares lookups
  try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_note_user_shares_note ON note_user_shares(note_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_note_user_shares_shared_with ON note_user_shares(shared_with_id)`);
  } catch (e: any) {
    // Ignore if already exists
  }

  console.log('Database initialized successfully');
}

// Get note tree for a user using recursive CTE (excludes deleted notes)
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
        is_favorite,
        editor_width,
        created_at,
        updated_at,
        0 AS depth
      FROM notes
      WHERE user_id = ? AND parent_id IS NULL AND deleted_at IS NULL

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
        n.is_favorite,
        n.editor_width,
        n.created_at,
        n.updated_at,
        nt.depth + 1
      FROM notes n
      INNER JOIN note_tree nt ON n.parent_id = nt.id
      WHERE n.deleted_at IS NULL
    )
    SELECT * FROM note_tree ORDER BY depth, sort_order
  `);

  return stmt.all(userId);
}

// Transform database snake_case to camelCase
function transformNote(note: any) {
  return {
    id: note.id,
    parentId: note.parent_id,
    title: note.title,
    titleEmoji: note.title_emoji,
    content: note.content,
    sortOrder: note.sort_order,
    isExpanded: !!note.is_expanded,
    isFavorite: !!note.is_favorite,
    editorWidth: note.editor_width || 'centered',
    createdAt: note.created_at,
    updatedAt: note.updated_at
  };
}

// Build hierarchical tree structure from flat results
export function buildTreeStructure(flatNotes: any[]): any[] {
  const noteMap = new Map<number, any>();
  const roots: any[] = [];

  // First pass: create map of all notes with transformed field names
  for (const note of flatNotes) {
    noteMap.set(note.id, { ...transformNote(note), children: [] });
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
