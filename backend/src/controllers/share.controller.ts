import { Request, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { db } from '../database/db.js';
import { hashPassword, verifyPassword } from '../utils/password.js';

const createShareSchema = z.object({
  password: z.string().optional(),
  expiresIn: z.enum(['1h', '1d', '7d', '30d', 'never']).optional()
});

const accessShareSchema = z.object({
  password: z.string().optional()
});

function generateShareToken(): string {
  return crypto.randomBytes(16).toString('base64url');
}

function getExpirationDate(expiresIn: string | undefined): string | null {
  if (!expiresIn || expiresIn === 'never') return null;

  const now = new Date();
  switch (expiresIn) {
    case '1h':
      now.setHours(now.getHours() + 1);
      break;
    case '1d':
      now.setDate(now.getDate() + 1);
      break;
    case '7d':
      now.setDate(now.getDate() + 7);
      break;
    case '30d':
      now.setDate(now.getDate() + 30);
      break;
  }
  return now.toISOString();
}

export async function createShare(req: Request, res: Response) {
  try {
    const noteId = parseInt(req.params.id);
    const result = createShareSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ error: 'Invalid input', details: result.error.errors });
      return;
    }

    const { password, expiresIn } = result.data;
    const userId = req.user!.userId;

    // Verify note belongs to user
    const note = db.prepare('SELECT id FROM notes WHERE id = ? AND user_id = ?')
      .get(noteId, userId);
    if (!note) {
      res.status(404).json({ error: 'Note not found' });
      return;
    }

    // Check if share already exists
    const existingShare = db.prepare('SELECT id, share_token FROM shared_notes WHERE note_id = ?')
      .get(noteId) as any;

    if (existingShare) {
      // Update existing share
      const passwordHash = password ? await hashPassword(password) : null;
      const expiresAt = getExpirationDate(expiresIn);

      db.prepare(`
        UPDATE shared_notes
        SET password_hash = ?, expires_at = ?
        WHERE id = ?
      `).run(passwordHash, expiresAt, existingShare.id);

      res.json({
        shareToken: existingShare.share_token,
        hasPassword: !!password,
        expiresAt
      });
      return;
    }

    // Create new share
    const shareToken = generateShareToken();
    const passwordHash = password ? await hashPassword(password) : null;
    const expiresAt = getExpirationDate(expiresIn);

    db.prepare(`
      INSERT INTO shared_notes (note_id, share_token, password_hash, expires_at)
      VALUES (?, ?, ?, ?)
    `).run(noteId, shareToken, passwordHash, expiresAt);

    res.status(201).json({
      shareToken,
      hasPassword: !!password,
      expiresAt
    });
  } catch (error) {
    console.error('Create share error:', error);
    res.status(500).json({ error: 'Failed to create share' });
  }
}

export async function getShareInfo(req: Request, res: Response) {
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

    const share = db.prepare(`
      SELECT share_token, password_hash, expires_at, view_count, created_at
      FROM shared_notes WHERE note_id = ?
    `).get(noteId) as any;

    if (!share) {
      res.json({ isShared: false });
      return;
    }

    res.json({
      isShared: true,
      shareToken: share.share_token,
      hasPassword: !!share.password_hash,
      expiresAt: share.expires_at,
      viewCount: share.view_count,
      createdAt: share.created_at
    });
  } catch (error) {
    console.error('Get share info error:', error);
    res.status(500).json({ error: 'Failed to get share info' });
  }
}

export async function deleteShare(req: Request, res: Response) {
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

    db.prepare('DELETE FROM shared_notes WHERE note_id = ?').run(noteId);

    res.json({ message: 'Share deleted successfully' });
  } catch (error) {
    console.error('Delete share error:', error);
    res.status(500).json({ error: 'Failed to delete share' });
  }
}

// Public endpoint - no auth required
export async function getSharedNote(req: Request, res: Response) {
  try {
    const { token } = req.params;
    const result = accessShareSchema.safeParse(req.body);
    const password = result.success ? result.data.password : undefined;

    const share = db.prepare(`
      SELECT s.*, n.title, n.title_emoji, n.content
      FROM shared_notes s
      JOIN notes n ON s.note_id = n.id
      WHERE s.share_token = ?
    `).get(token) as any;

    if (!share) {
      res.status(404).json({ error: 'Shared note not found' });
      return;
    }

    // Check expiration
    if (share.expires_at && new Date(share.expires_at) < new Date()) {
      res.status(410).json({ error: 'This shared link has expired' });
      return;
    }

    // Check password
    if (share.password_hash) {
      if (!password) {
        res.status(401).json({ error: 'Password required', requiresPassword: true });
        return;
      }

      const validPassword = await verifyPassword(password, share.password_hash);
      if (!validPassword) {
        res.status(401).json({ error: 'Invalid password', requiresPassword: true });
        return;
      }
    }

    // Increment view count
    db.prepare('UPDATE shared_notes SET view_count = view_count + 1 WHERE id = ?')
      .run(share.id);

    res.json({
      title: share.title,
      titleEmoji: share.title_emoji,
      content: share.content
    });
  } catch (error) {
    console.error('Get shared note error:', error);
    res.status(500).json({ error: 'Failed to get shared note' });
  }
}

// Check if password is required (no auth needed)
export async function checkShareAccess(req: Request, res: Response) {
  try {
    const { token } = req.params;

    const share = db.prepare(`
      SELECT password_hash, expires_at
      FROM shared_notes
      WHERE share_token = ?
    `).get(token) as any;

    if (!share) {
      res.status(404).json({ error: 'Shared note not found' });
      return;
    }

    // Check expiration
    if (share.expires_at && new Date(share.expires_at) < new Date()) {
      res.status(410).json({ error: 'This shared link has expired' });
      return;
    }

    res.json({
      requiresPassword: !!share.password_hash
    });
  } catch (error) {
    console.error('Check share access error:', error);
    res.status(500).json({ error: 'Failed to check share access' });
  }
}
