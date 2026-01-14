import { Request, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { db, getNoteTree, buildTreeStructure } from '../database/db.js';
import {
  generateEmbedding,
  embeddingToBuffer,
  bufferToEmbedding,
  cosineSimilarity,
  prepareNoteText,
  stripHtml,
  isEmbeddingsAvailable
} from '../services/embeddings.service.js';

// Validation schemas
const createNoteSchema = z.object({
  parentId: z.number().nullable().optional(),
  title: z.string().default('Untitled'),
  titleEmoji: z.string().nullable().optional(),
  content: z.string().default('')
});

const updateNoteSchema = z.object({
  title: z.string().optional(),
  titleEmoji: z.string().nullable().optional(),
  content: z.string().optional(),
  editorWidth: z.enum(['centered', 'full']).optional()
});

const moveNoteSchema = z.object({
  parentId: z.number().nullable()
});

const reorderNoteSchema = z.object({
  sortOrder: z.number()
});

// Track users who have had auto-indexing triggered (to avoid repeated triggers)
const usersWithIndexingTriggered = new Set<number>();

/**
 * Update embedding for a note (runs asynchronously, doesn't block request)
 */
async function updateNoteEmbedding(noteId: number, title: string, content: string): Promise<void> {
  try {
    const text = prepareNoteText(title, content);
    // Skip very short notes
    if (text.length < 10) {
      return;
    }
    const embedding = await generateEmbedding(text);
    const buffer = embeddingToBuffer(embedding);
    db.prepare('UPDATE notes SET embedding = ? WHERE id = ?').run(buffer, noteId);
  } catch (error) {
    console.error(`Failed to generate embedding for note ${noteId}:`, error);
  }
}

/**
 * Generate MD5 hash of content for version comparison
 */
function hashContent(content: string): string {
  return crypto.createHash('md5').update(content).digest('hex');
}

/**
 * Save a version of the note if content has changed and enough time has passed
 * Returns true if a new version was created
 */
function saveNoteVersion(noteId: number, userId: number, title: string, content: string): boolean {
  const contentHash = hashContent(content);

  // Check the latest version
  const lastVersion = db.prepare(`
    SELECT content_hash, version_number, created_at FROM note_versions
    WHERE note_id = ? ORDER BY version_number DESC LIMIT 1
  `).get(noteId) as { content_hash: string; version_number: number; created_at: string } | undefined;

  // Skip if content hasn't changed
  if (lastVersion && lastVersion.content_hash === contentHash) {
    return false;
  }

  // Skip if last version was created less than 30 seconds ago
  if (lastVersion) {
    const lastVersionTime = new Date(lastVersion.created_at + 'Z').getTime();
    const now = Date.now();
    const secondsSinceLastVersion = (now - lastVersionTime) / 1000;
    if (secondsSinceLastVersion < 30) {
      return false;
    }
  }

  const nextVersionNumber = (lastVersion?.version_number ?? 0) + 1;

  // Insert new version
  db.prepare(`
    INSERT INTO note_versions (note_id, user_id, title, content, content_hash, version_number)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(noteId, userId, title, content, contentHash, nextVersionNumber);

  // Enforce 50 version limit - delete oldest versions if exceeded
  db.prepare(`
    DELETE FROM note_versions
    WHERE note_id = ? AND id NOT IN (
      SELECT id FROM note_versions
      WHERE note_id = ?
      ORDER BY version_number DESC
      LIMIT 50
    )
  `).run(noteId, noteId);

  return true;
}

export async function getNotesTree(req: Request, res: Response) {
  try {
    const flatNotes = getNoteTree(req.user!.userId);
    const tree = buildTreeStructure(flatNotes);
    res.json(tree);
  } catch (error) {
    console.error('Get notes tree error:', error);
    res.status(500).json({ error: 'Failed to get notes' });
  }
}

export async function getNote(req: Request, res: Response) {
  try {
    const noteId = parseInt(req.params.id);

    const note = db.prepare(`
      SELECT id, user_id, parent_id, title, title_emoji, content, sort_order, is_expanded, editor_width, created_at, updated_at
      FROM notes WHERE id = ? AND user_id = ?
    `).get(noteId, req.user!.userId) as any;

    if (!note) {
      res.status(404).json({ error: 'Note not found' });
      return;
    }

    res.json({
      id: note.id,
      parentId: note.parent_id,
      title: note.title,
      titleEmoji: note.title_emoji,
      content: note.content,
      sortOrder: note.sort_order,
      isExpanded: !!note.is_expanded,
      editorWidth: note.editor_width || 'centered',
      createdAt: note.created_at,
      updatedAt: note.updated_at
    });
  } catch (error) {
    console.error('Get note error:', error);
    res.status(500).json({ error: 'Failed to get note' });
  }
}

export async function createNote(req: Request, res: Response) {
  try {
    const result = createNoteSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ error: 'Invalid input', details: result.error.errors });
      return;
    }

    const { parentId, title, titleEmoji, content } = result.data;
    const userId = req.user!.userId;

    // If parent specified, verify it belongs to user
    if (parentId) {
      const parent = db.prepare('SELECT id FROM notes WHERE id = ? AND user_id = ?')
        .get(parentId, userId);
      if (!parent) {
        res.status(400).json({ error: 'Parent note not found' });
        return;
      }
    }

    // Get max sort order for siblings
    const maxOrder = db.prepare(`
      SELECT COALESCE(MAX(sort_order), -1) as max_order
      FROM notes WHERE user_id = ? AND parent_id IS ?
    `).get(userId, parentId || null) as { max_order: number };

    const sortOrder = maxOrder.max_order + 1;

    const stmt = db.prepare(`
      INSERT INTO notes (user_id, parent_id, title, title_emoji, content, sort_order)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const insertResult = stmt.run(userId, parentId || null, title, titleEmoji || null, content, sortOrder);

    const noteId = insertResult.lastInsertRowid as number;

    // Generate embedding asynchronously (don't await)
    updateNoteEmbedding(noteId, title, content);

    res.status(201).json({
      id: noteId,
      parentId: parentId || null,
      title,
      titleEmoji: titleEmoji || null,
      content,
      sortOrder,
      isExpanded: true,
      children: []
    });
  } catch (error) {
    console.error('Create note error:', error);
    res.status(500).json({ error: 'Failed to create note' });
  }
}

export async function updateNote(req: Request, res: Response) {
  try {
    const noteId = parseInt(req.params.id);
    const result = updateNoteSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ error: 'Invalid input', details: result.error.errors });
      return;
    }

    const { title, titleEmoji, content, editorWidth } = result.data;
    const userId = req.user!.userId;

    // Verify note belongs to user and get current content for versioning
    const note = db.prepare('SELECT id, title, content FROM notes WHERE id = ? AND user_id = ?')
      .get(noteId, userId) as { id: number; title: string; content: string } | undefined;
    if (!note) {
      res.status(404).json({ error: 'Note not found' });
      return;
    }

    // Save a version before updating (if content is changing)
    if (content !== undefined && content !== note.content) {
      saveNoteVersion(noteId, userId, note.title, note.content);
    }

    // Build update query dynamically
    const updates: string[] = ['updated_at = CURRENT_TIMESTAMP'];
    const params: any[] = [];

    if (title !== undefined) {
      updates.push('title = ?');
      params.push(title);
    }
    if (titleEmoji !== undefined) {
      updates.push('title_emoji = ?');
      params.push(titleEmoji);
    }
    if (content !== undefined) {
      updates.push('content = ?');
      params.push(content);
    }
    if (editorWidth !== undefined) {
      updates.push('editor_width = ?');
      params.push(editorWidth);
    }

    params.push(noteId);

    db.prepare(`UPDATE notes SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    // Return updated note
    const updated = db.prepare(`
      SELECT id, parent_id, title, title_emoji, content, sort_order, is_expanded, editor_width, updated_at
      FROM notes WHERE id = ?
    `).get(noteId) as any;

    // Regenerate embedding if title or content changed (async, don't await)
    if (title !== undefined || content !== undefined) {
      updateNoteEmbedding(noteId, updated.title, updated.content);
    }

    res.json({
      id: updated.id,
      parentId: updated.parent_id,
      title: updated.title,
      titleEmoji: updated.title_emoji,
      content: updated.content,
      sortOrder: updated.sort_order,
      isExpanded: !!updated.is_expanded,
      editorWidth: updated.editor_width || 'centered',
      updatedAt: updated.updated_at
    });
  } catch (error) {
    console.error('Update note error:', error);
    res.status(500).json({ error: 'Failed to update note' });
  }
}

export async function deleteNote(req: Request, res: Response) {
  try {
    const noteId = parseInt(req.params.id);
    const userId = req.user!.userId;

    // Verify note belongs to user
    const note = db.prepare('SELECT id FROM notes WHERE id = ? AND user_id = ? AND deleted_at IS NULL')
      .get(noteId, userId);
    if (!note) {
      res.status(404).json({ error: 'Note not found' });
      return;
    }

    // Soft delete: set deleted_at for the note and all its children
    db.prepare(`
      WITH RECURSIVE descendants AS (
        SELECT id FROM notes WHERE id = ?
        UNION ALL
        SELECT n.id FROM notes n INNER JOIN descendants d ON n.parent_id = d.id
      )
      UPDATE notes SET deleted_at = CURRENT_TIMESTAMP WHERE id IN (SELECT id FROM descendants)
    `).run(noteId);

    res.json({ message: 'Note moved to trash' });
  } catch (error) {
    console.error('Delete note error:', error);
    res.status(500).json({ error: 'Failed to delete note' });
  }
}

export async function moveNote(req: Request, res: Response) {
  try {
    const noteId = parseInt(req.params.id);
    const result = moveNoteSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ error: 'Invalid input', details: result.error.errors });
      return;
    }

    const { parentId } = result.data;
    const userId = req.user!.userId;

    // Verify note belongs to user
    const note = db.prepare('SELECT id, parent_id FROM notes WHERE id = ? AND user_id = ?')
      .get(noteId, userId) as any;
    if (!note) {
      res.status(404).json({ error: 'Note not found' });
      return;
    }

    // If parent specified, verify it belongs to user and isn't a descendant
    if (parentId !== null) {
      const parent = db.prepare('SELECT id FROM notes WHERE id = ? AND user_id = ?')
        .get(parentId, userId);
      if (!parent) {
        res.status(400).json({ error: 'Parent note not found' });
        return;
      }

      // Check if trying to move to a descendant (would create cycle)
      const isDescendant = db.prepare(`
        WITH RECURSIVE descendants AS (
          SELECT id FROM notes WHERE parent_id = ?
          UNION ALL
          SELECT n.id FROM notes n INNER JOIN descendants d ON n.parent_id = d.id
        )
        SELECT id FROM descendants WHERE id = ?
      `).get(noteId, parentId);

      if (isDescendant) {
        res.status(400).json({ error: 'Cannot move note to its own descendant' });
        return;
      }
    }

    // Get max sort order for new siblings
    const maxOrder = db.prepare(`
      SELECT COALESCE(MAX(sort_order), -1) as max_order
      FROM notes WHERE user_id = ? AND parent_id IS ?
    `).get(userId, parentId) as { max_order: number };

    db.prepare(`
      UPDATE notes SET parent_id = ?, sort_order = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(parentId, maxOrder.max_order + 1, noteId);

    res.json({ message: 'Note moved successfully' });
  } catch (error) {
    console.error('Move note error:', error);
    res.status(500).json({ error: 'Failed to move note' });
  }
}

export async function reorderNote(req: Request, res: Response) {
  try {
    const noteId = parseInt(req.params.id);
    const result = reorderNoteSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ error: 'Invalid input', details: result.error.errors });
      return;
    }

    const { sortOrder } = result.data;
    const userId = req.user!.userId;

    // Verify note belongs to user
    const note = db.prepare('SELECT id FROM notes WHERE id = ? AND user_id = ?')
      .get(noteId, userId);
    if (!note) {
      res.status(404).json({ error: 'Note not found' });
      return;
    }

    db.prepare('UPDATE notes SET sort_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(sortOrder, noteId);

    res.json({ message: 'Note reordered successfully' });
  } catch (error) {
    console.error('Reorder note error:', error);
    res.status(500).json({ error: 'Failed to reorder note' });
  }
}

export async function toggleExpand(req: Request, res: Response) {
  try {
    const noteId = parseInt(req.params.id);
    const userId = req.user!.userId;

    // Verify note belongs to user
    const note = db.prepare('SELECT id, is_expanded FROM notes WHERE id = ? AND user_id = ?')
      .get(noteId, userId) as any;
    if (!note) {
      res.status(404).json({ error: 'Note not found' });
      return;
    }

    const newExpanded = !note.is_expanded;
    db.prepare('UPDATE notes SET is_expanded = ? WHERE id = ?').run(newExpanded ? 1 : 0, noteId);

    res.json({ isExpanded: newExpanded });
  } catch (error) {
    console.error('Toggle expand error:', error);
    res.status(500).json({ error: 'Failed to toggle expansion' });
  }
}

export async function duplicateNote(req: Request, res: Response) {
  try {
    const noteId = parseInt(req.params.id);
    const userId = req.user!.userId;

    // Get the note to duplicate
    const note = db.prepare(`
      SELECT id, parent_id, title, title_emoji, content
      FROM notes WHERE id = ? AND user_id = ?
    `).get(noteId, userId) as any;

    if (!note) {
      res.status(404).json({ error: 'Note not found' });
      return;
    }

    // Get max sort order for siblings
    const maxOrder = db.prepare(`
      SELECT COALESCE(MAX(sort_order), -1) as max_order
      FROM notes WHERE user_id = ? AND parent_id IS ?
    `).get(userId, note.parent_id) as { max_order: number };

    const sortOrder = maxOrder.max_order + 1;

    // Create duplicate with "(Copy)" suffix
    const stmt = db.prepare(`
      INSERT INTO notes (user_id, parent_id, title, title_emoji, content, sort_order)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const insertResult = stmt.run(
      userId,
      note.parent_id,
      `${note.title} (Copy)`,
      note.title_emoji,
      note.content,
      sortOrder
    );

    res.status(201).json({
      id: insertResult.lastInsertRowid,
      parentId: note.parent_id,
      title: `${note.title} (Copy)`,
      titleEmoji: note.title_emoji,
      content: note.content,
      sortOrder,
      isExpanded: true,
      children: []
    });
  } catch (error) {
    console.error('Duplicate note error:', error);
    res.status(500).json({ error: 'Failed to duplicate note' });
  }
}

export async function searchNotes(req: Request, res: Response) {
  try {
    const query = req.query.q as string;
    if (!query || query.trim().length < 2) {
      res.json([]);
      return;
    }

    const userId = req.user!.userId;
    const searchTerm = `%${query.trim()}%`;

    // 1. Keyword search (fast, exact matches)
    const keywordResults = db.prepare(`
      SELECT id, title, title_emoji, content, updated_at, embedding
      FROM notes
      WHERE user_id = ? AND deleted_at IS NULL AND (title LIKE ? OR content LIKE ?)
      ORDER BY updated_at DESC
      LIMIT 20
    `).all(userId, searchTerm, searchTerm) as any[];

    // Auto-index: Check if there are unindexed notes and trigger background indexing
    // Only if embeddings are available (not disabled due to ONNX issues)
    if (!usersWithIndexingTriggered.has(userId) && isEmbeddingsAvailable()) {
      const unindexedCount = db.prepare(`
        SELECT COUNT(*) as count FROM notes
        WHERE user_id = ? AND deleted_at IS NULL AND embedding IS NULL
      `).get(userId) as { count: number };

      if (unindexedCount.count > 0) {
        usersWithIndexingTriggered.add(userId);
        console.log(`Auto-indexing ${unindexedCount.count} notes for user ${userId}...`);

        // Get all unindexed notes and start background indexing
        const notesToIndex = db.prepare(`
          SELECT id, title, content FROM notes
          WHERE user_id = ? AND deleted_at IS NULL AND embedding IS NULL
        `).all(userId) as any[];

        // Run indexing in background (don't await)
        (async () => {
          let indexed = 0;
          for (const note of notesToIndex) {
            try {
              await updateNoteEmbedding(note.id, note.title, note.content);
              indexed++;
            } catch (error: any) {
              // If embeddings got disabled during indexing, stop
              if (!isEmbeddingsAvailable()) {
                console.log('Auto-indexing stopped: embeddings became unavailable');
                break;
              }
              console.error(`Failed to index note ${note.id}:`, error);
            }
          }
          console.log(`Auto-indexing complete: ${indexed}/${notesToIndex.length} notes for user ${userId}`);
        })().catch(err => console.error('Auto-indexing error:', err));
      } else {
        // All notes already indexed, mark as triggered
        usersWithIndexingTriggered.add(userId);
      }
    }

    // 2. Semantic search (find similar notes by meaning)
    // Only if embeddings are available
    let semanticResults: any[] = [];
    if (isEmbeddingsAvailable()) {
      try {
        // Generate embedding for the query
        const queryEmbedding = await generateEmbedding(query);

        // Get all notes with embeddings for this user
        const allNotes = db.prepare(`
          SELECT id, title, title_emoji, content, updated_at, embedding
          FROM notes
          WHERE user_id = ? AND deleted_at IS NULL AND embedding IS NOT NULL
        `).all(userId) as any[];

        // Calculate similarity scores
        const scored = allNotes
          .map(note => {
            const noteEmbedding = bufferToEmbedding(note.embedding);
            const similarity = cosineSimilarity(queryEmbedding, noteEmbedding);
            return { ...note, similarity };
          })
          .filter(note => note.similarity > 0.5) // Only include reasonably similar notes
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, 15);

        semanticResults = scored;
      } catch (error) {
        console.error('Semantic search error:', error);
        // Continue with just keyword results if semantic search fails
      }
    }

    // 3. Merge results - keyword matches first, then semantic (avoiding duplicates)
    const seenIds = new Set<number>();
    const mergedResults: any[] = [];

    // Add keyword results first (they're exact matches)
    for (const note of keywordResults) {
      if (!seenIds.has(note.id)) {
        seenIds.add(note.id);
        mergedResults.push({ ...note, matchType: 'keyword' });
      }
    }

    // Add semantic results that aren't already included
    for (const note of semanticResults) {
      if (!seenIds.has(note.id)) {
        seenIds.add(note.id);
        mergedResults.push({ ...note, matchType: 'semantic' });
      }
    }

    // 4. Format results with preview snippets
    const formattedResults = mergedResults.slice(0, 20).map(note => {
      let preview = '';
      const plainContent = stripHtml(note.content);
      const lowerQuery = query.toLowerCase();
      const lowerContent = plainContent.toLowerCase();
      const matchIndex = lowerContent.indexOf(lowerQuery);

      if (matchIndex !== -1) {
        const start = Math.max(0, matchIndex - 40);
        const end = Math.min(plainContent.length, matchIndex + query.length + 40);
        preview = (start > 0 ? '...' : '') +
                  plainContent.slice(start, end) +
                  (end < plainContent.length ? '...' : '');
      } else {
        preview = plainContent.slice(0, 80) + (plainContent.length > 80 ? '...' : '');
      }

      return {
        id: note.id,
        title: note.title,
        titleEmoji: note.title_emoji,
        preview,
        updatedAt: note.updated_at,
        matchType: note.matchType
      };
    });

    res.json(formattedResults);
  } catch (error) {
    console.error('Search notes error:', error);
    res.status(500).json({ error: 'Failed to search notes' });
  }
}

// Trash functions

export async function getDeletedNotes(req: Request, res: Response) {
  try {
    const userId = req.user!.userId;

    // Get all deleted notes (only root deleted notes, not children that were deleted as part of parent)
    const deletedNotes = db.prepare(`
      SELECT id, title, title_emoji, created_at, deleted_at
      FROM notes
      WHERE user_id = ? AND deleted_at IS NOT NULL
      ORDER BY deleted_at DESC
    `).all(userId) as any[];

    const formatted = deletedNotes.map(note => ({
      id: note.id,
      title: note.title,
      titleEmoji: note.title_emoji,
      createdAt: note.created_at,
      deletedAt: note.deleted_at
    }));

    res.json(formatted);
  } catch (error) {
    console.error('Get deleted notes error:', error);
    res.status(500).json({ error: 'Failed to get deleted notes' });
  }
}

const restoreNotesSchema = z.object({
  noteIds: z.array(z.number()).min(1)
});

export async function restoreNotes(req: Request, res: Response) {
  try {
    const result = restoreNotesSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ error: 'Invalid input', details: result.error.errors });
      return;
    }

    const { noteIds } = result.data;
    const userId = req.user!.userId;

    // Verify all notes belong to user and are deleted
    const placeholders = noteIds.map(() => '?').join(',');
    const notes = db.prepare(`
      SELECT id FROM notes
      WHERE id IN (${placeholders}) AND user_id = ? AND deleted_at IS NOT NULL
    `).all(...noteIds, userId) as any[];

    if (notes.length !== noteIds.length) {
      res.status(400).json({ error: 'Some notes not found or not deleted' });
      return;
    }

    // Restore notes by clearing deleted_at
    // Also restore all children
    for (const noteId of noteIds) {
      db.prepare(`
        WITH RECURSIVE descendants AS (
          SELECT id FROM notes WHERE id = ?
          UNION ALL
          SELECT n.id FROM notes n INNER JOIN descendants d ON n.parent_id = d.id
        )
        UPDATE notes SET deleted_at = NULL WHERE id IN (SELECT id FROM descendants)
      `).run(noteId);
    }

    res.json({ message: 'Notes restored successfully', count: noteIds.length });
  } catch (error) {
    console.error('Restore notes error:', error);
    res.status(500).json({ error: 'Failed to restore notes' });
  }
}

const permanentDeleteSchema = z.object({
  noteIds: z.array(z.number()).min(1)
});

export async function permanentlyDeleteNotes(req: Request, res: Response) {
  try {
    const result = permanentDeleteSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ error: 'Invalid input', details: result.error.errors });
      return;
    }

    const { noteIds } = result.data;
    const userId = req.user!.userId;

    // Verify all notes belong to user and are deleted
    const placeholders = noteIds.map(() => '?').join(',');
    const notes = db.prepare(`
      SELECT id FROM notes
      WHERE id IN (${placeholders}) AND user_id = ? AND deleted_at IS NOT NULL
    `).all(...noteIds, userId) as any[];

    if (notes.length !== noteIds.length) {
      res.status(400).json({ error: 'Some notes not found or not in trash' });
      return;
    }

    // Permanently delete notes (cascade will delete children)
    db.prepare(`DELETE FROM notes WHERE id IN (${placeholders})`).run(...noteIds);

    res.json({ message: 'Notes permanently deleted', count: noteIds.length });
  } catch (error) {
    console.error('Permanent delete error:', error);
    res.status(500).json({ error: 'Failed to permanently delete notes' });
  }
}

export async function getAutoDeleteDays(req: Request, res: Response) {
  try {
    const userId = req.user!.userId;

    const user = db.prepare('SELECT auto_delete_days FROM users WHERE id = ?').get(userId) as any;

    res.json({ autoDeleteDays: user?.auto_delete_days ?? 30 });
  } catch (error) {
    console.error('Get auto delete days error:', error);
    res.status(500).json({ error: 'Failed to get setting' });
  }
}

const updateAutoDeleteSchema = z.object({
  days: z.number().min(1).max(365)
});

export async function updateAutoDeleteDays(req: Request, res: Response) {
  try {
    const result = updateAutoDeleteSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ error: 'Invalid input', details: result.error.errors });
      return;
    }

    const { days } = result.data;
    const userId = req.user!.userId;

    db.prepare('UPDATE users SET auto_delete_days = ? WHERE id = ?').run(days, userId);

    // Also permanently delete notes that exceed the new threshold
    db.prepare(`
      DELETE FROM notes
      WHERE user_id = ?
      AND deleted_at IS NOT NULL
      AND deleted_at < datetime('now', '-' || ? || ' days')
    `).run(userId, days);

    res.json({ autoDeleteDays: days });
  } catch (error) {
    console.error('Update auto delete days error:', error);
    res.status(500).json({ error: 'Failed to update setting' });
  }
}

export async function emptyTrash(req: Request, res: Response) {
  try {
    const userId = req.user!.userId;

    const result = db.prepare(`
      DELETE FROM notes WHERE user_id = ? AND deleted_at IS NOT NULL
    `).run(userId);

    res.json({ message: 'Trash emptied', count: result.changes });
  } catch (error) {
    console.error('Empty trash error:', error);
    res.status(500).json({ error: 'Failed to empty trash' });
  }
}

/**
 * Reindex all notes for a user - generates embeddings for notes that don't have them
 */
export async function reindexNotes(req: Request, res: Response) {
  try {
    const userId = req.user!.userId;

    // Get all notes without embeddings
    const notesToIndex = db.prepare(`
      SELECT id, title, content
      FROM notes
      WHERE user_id = ? AND deleted_at IS NULL AND embedding IS NULL
    `).all(userId) as any[];

    // Start indexing in background
    const indexPromise = (async () => {
      let indexed = 0;
      for (const note of notesToIndex) {
        try {
          await updateNoteEmbedding(note.id, note.title, note.content);
          indexed++;
        } catch (error) {
          console.error(`Failed to index note ${note.id}:`, error);
        }
      }
      console.log(`Indexed ${indexed}/${notesToIndex.length} notes for user ${userId}`);
    })();

    // Don't await - let it run in background
    indexPromise.catch(err => console.error('Reindex error:', err));

    res.json({
      message: 'Reindexing started',
      notesToIndex: notesToIndex.length
    });
  } catch (error) {
    console.error('Reindex notes error:', error);
    res.status(500).json({ error: 'Failed to start reindexing' });
  }
}

/**
 * Get indexing status - how many notes have embeddings
 */
export async function getIndexStatus(req: Request, res: Response) {
  try {
    const userId = req.user!.userId;

    const stats = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN embedding IS NOT NULL THEN 1 ELSE 0 END) as indexed
      FROM notes
      WHERE user_id = ? AND deleted_at IS NULL
    `).get(userId) as { total: number; indexed: number };

    res.json({
      total: stats.total,
      indexed: stats.indexed,
      pending: stats.total - stats.indexed,
      percentage: stats.total > 0 ? Math.round((stats.indexed / stats.total) * 100) : 100
    });
  } catch (error) {
    console.error('Get index status error:', error);
    res.status(500).json({ error: 'Failed to get index status' });
  }
}

// Version History functions

/**
 * Get list of versions for a note (summary only, not full content)
 */
export async function getNoteVersions(req: Request, res: Response) {
  try {
    const noteId = parseInt(req.params.id);
    const userId = req.user!.userId;

    // Verify note belongs to user
    const note = db.prepare('SELECT id FROM notes WHERE id = ? AND user_id = ?')
      .get(noteId, userId);
    if (!note) {
      res.status(404).json({ error: 'Note not found' });
      return;
    }

    const versions = db.prepare(`
      SELECT id, version_number, created_at
      FROM note_versions
      WHERE note_id = ?
      ORDER BY version_number DESC
    `).all(noteId) as any[];

    res.json(versions.map(v => ({
      id: v.id,
      versionNumber: v.version_number,
      createdAt: v.created_at
    })));
  } catch (error) {
    console.error('Get note versions error:', error);
    res.status(500).json({ error: 'Failed to get note versions' });
  }
}

/**
 * Get a specific version with full content
 */
export async function getNoteVersion(req: Request, res: Response) {
  try {
    const noteId = parseInt(req.params.id);
    const versionId = parseInt(req.params.versionId);
    const userId = req.user!.userId;

    // Verify note belongs to user
    const note = db.prepare('SELECT id FROM notes WHERE id = ? AND user_id = ?')
      .get(noteId, userId);
    if (!note) {
      res.status(404).json({ error: 'Note not found' });
      return;
    }

    const version = db.prepare(`
      SELECT id, version_number, title, content, created_at
      FROM note_versions
      WHERE id = ? AND note_id = ?
    `).get(versionId, noteId) as any;

    if (!version) {
      res.status(404).json({ error: 'Version not found' });
      return;
    }

    res.json({
      id: version.id,
      versionNumber: version.version_number,
      title: version.title,
      content: version.content,
      createdAt: version.created_at
    });
  } catch (error) {
    console.error('Get note version error:', error);
    res.status(500).json({ error: 'Failed to get note version' });
  }
}

/**
 * Restore a note to a previous version
 * This saves the current state as a new version, then replaces content with the old version
 */
export async function restoreNoteVersion(req: Request, res: Response) {
  try {
    const noteId = parseInt(req.params.id);
    const versionId = parseInt(req.params.versionId);
    const userId = req.user!.userId;

    // Get current note
    const note = db.prepare('SELECT id, title, content FROM notes WHERE id = ? AND user_id = ?')
      .get(noteId, userId) as { id: number; title: string; content: string } | undefined;
    if (!note) {
      res.status(404).json({ error: 'Note not found' });
      return;
    }

    // Get the version to restore
    const version = db.prepare(`
      SELECT title, content
      FROM note_versions
      WHERE id = ? AND note_id = ?
    `).get(versionId, noteId) as { title: string; content: string } | undefined;

    if (!version) {
      res.status(404).json({ error: 'Version not found' });
      return;
    }

    // Save current state as a new version before restoring
    saveNoteVersion(noteId, userId, note.title, note.content);

    // Update the note with the restored content
    db.prepare(`
      UPDATE notes SET title = ?, content = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(version.title, version.content, noteId);

    // Regenerate embedding for the restored content
    updateNoteEmbedding(noteId, version.title, version.content);

    res.json({ message: 'Note restored successfully' });
  } catch (error) {
    console.error('Restore note version error:', error);
    res.status(500).json({ error: 'Failed to restore note version' });
  }
}
