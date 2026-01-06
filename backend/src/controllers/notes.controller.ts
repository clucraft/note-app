import { Request, Response } from 'express';
import { z } from 'zod';
import { db, getNoteTree, buildTreeStructure } from '../database/db.js';

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

    res.status(201).json({
      id: insertResult.lastInsertRowid,
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

    // Verify note belongs to user
    const note = db.prepare('SELECT id FROM notes WHERE id = ? AND user_id = ?')
      .get(noteId, userId);
    if (!note) {
      res.status(404).json({ error: 'Note not found' });
      return;
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
    const note = db.prepare('SELECT id FROM notes WHERE id = ? AND user_id = ?')
      .get(noteId, userId);
    if (!note) {
      res.status(404).json({ error: 'Note not found' });
      return;
    }

    // Delete note (cascade will delete children)
    db.prepare('DELETE FROM notes WHERE id = ?').run(noteId);

    res.json({ message: 'Note deleted successfully' });
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

    const results = db.prepare(`
      SELECT id, title, title_emoji, content, updated_at
      FROM notes
      WHERE user_id = ? AND (title LIKE ? OR content LIKE ?)
      ORDER BY updated_at DESC
      LIMIT 20
    `).all(userId, searchTerm, searchTerm) as any[];

    // Generate preview snippets with matched text
    const formattedResults = results.map(note => {
      let preview = '';
      const lowerQuery = query.toLowerCase();
      const lowerContent = note.content.toLowerCase();
      const matchIndex = lowerContent.indexOf(lowerQuery);

      if (matchIndex !== -1) {
        const start = Math.max(0, matchIndex - 40);
        const end = Math.min(note.content.length, matchIndex + query.length + 40);
        preview = (start > 0 ? '...' : '') +
                  note.content.slice(start, end) +
                  (end < note.content.length ? '...' : '');
      } else {
        preview = note.content.slice(0, 80) + (note.content.length > 80 ? '...' : '');
      }

      return {
        id: note.id,
        title: note.title,
        titleEmoji: note.title_emoji,
        preview,
        updatedAt: note.updated_at
      };
    });

    res.json(formattedResults);
  } catch (error) {
    console.error('Search notes error:', error);
    res.status(500).json({ error: 'Failed to search notes' });
  }
}
