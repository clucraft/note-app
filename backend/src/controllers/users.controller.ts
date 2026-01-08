import { Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../database/db.js';
import { hashPassword } from '../utils/password.js';

const updateUserSchema = z.object({
  displayName: z.string().optional(),
  role: z.enum(['admin', 'user']).optional()
});

const createUserSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email(),
  password: z.string().min(6),
  displayName: z.string().optional(),
  role: z.enum(['admin', 'user']).default('user')
});

export async function listUsers(req: Request, res: Response) {
  try {
    const users = db.prepare(`
      SELECT id, username, email, display_name, role, theme_preference, totp_enabled, created_at
      FROM users ORDER BY created_at DESC
    `).all();

    res.json(users.map((u: any) => ({
      id: u.id,
      username: u.username,
      email: u.email,
      displayName: u.display_name,
      role: u.role,
      themePreference: u.theme_preference,
      totpEnabled: !!u.totp_enabled,
      createdAt: u.created_at
    })));
  } catch (error) {
    console.error('List users error:', error);
    res.status(500).json({ error: 'Failed to list users' });
  }
}

export async function getUser(req: Request, res: Response) {
  try {
    const userId = parseInt(req.params.id);

    const user = db.prepare(`
      SELECT id, username, email, display_name, role, theme_preference, created_at
      FROM users WHERE id = ?
    `).get(userId) as any;

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      displayName: user.display_name,
      role: user.role,
      themePreference: user.theme_preference,
      createdAt: user.created_at
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
}

export async function createUser(req: Request, res: Response) {
  try {
    const result = createUserSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ error: 'Invalid input', details: result.error.errors });
      return;
    }

    const { username, email, password, displayName, role } = result.data;

    // Check if user exists
    const existing = db.prepare('SELECT id FROM users WHERE email = ? OR username = ?')
      .get(email, username);
    if (existing) {
      res.status(400).json({ error: 'User already exists' });
      return;
    }

    const passwordHash = await hashPassword(password);

    const stmt = db.prepare(`
      INSERT INTO users (username, email, password_hash, display_name, role)
      VALUES (?, ?, ?, ?, ?)
    `);
    const insertResult = stmt.run(username, email, passwordHash, displayName || username, role);

    res.status(201).json({
      id: insertResult.lastInsertRowid,
      username,
      email,
      displayName: displayName || username,
      role
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
}

export async function updateUser(req: Request, res: Response) {
  try {
    const userId = parseInt(req.params.id);
    const result = updateUserSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ error: 'Invalid input', details: result.error.errors });
      return;
    }

    const { displayName, role } = result.data;

    // Verify user exists
    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Prevent removing last admin
    if (role === 'user') {
      const currentUser = db.prepare('SELECT role FROM users WHERE id = ?').get(userId) as any;
      if (currentUser.role === 'admin') {
        const adminCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'")
          .get() as { count: number };
        if (adminCount.count <= 1) {
          res.status(400).json({ error: 'Cannot remove the last admin' });
          return;
        }
      }
    }

    const updates: string[] = ['updated_at = CURRENT_TIMESTAMP'];
    const params: any[] = [];

    if (displayName !== undefined) {
      updates.push('display_name = ?');
      params.push(displayName);
    }
    if (role !== undefined) {
      updates.push('role = ?');
      params.push(role);
    }

    params.push(userId);

    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    const updated = db.prepare(`
      SELECT id, username, email, display_name, role
      FROM users WHERE id = ?
    `).get(userId) as any;

    res.json({
      id: updated.id,
      username: updated.username,
      email: updated.email,
      displayName: updated.display_name,
      role: updated.role
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
}

export async function deleteUser(req: Request, res: Response) {
  try {
    const userId = parseInt(req.params.id);

    // Verify user exists
    const user = db.prepare('SELECT id, role FROM users WHERE id = ?').get(userId) as any;
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Prevent deleting last admin
    if (user.role === 'admin') {
      const adminCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'")
        .get() as { count: number };
      if (adminCount.count <= 1) {
        res.status(400).json({ error: 'Cannot delete the last admin' });
        return;
      }
    }

    // Prevent self-deletion
    if (userId === req.user!.userId) {
      res.status(400).json({ error: 'Cannot delete yourself' });
      return;
    }

    // Delete user (cascade will delete notes and tokens)
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
}
