import { Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../database/db.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt.js';

// Validation schemas
const registerSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email(),
  password: z.string().min(6),
  displayName: z.string().optional()
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

export async function register(req: Request, res: Response) {
  try {
    const result = registerSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ error: 'Invalid input', details: result.error.errors });
      return;
    }

    const { username, email, password, displayName } = result.data;

    // Check if user exists
    const existing = db.prepare('SELECT id FROM users WHERE email = ? OR username = ?').get(email, username);
    if (existing) {
      res.status(400).json({ error: 'User already exists' });
      return;
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Check if this is the first user (make admin)
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
    const role = userCount.count === 0 ? 'admin' : 'user';

    // Insert user
    const stmt = db.prepare(`
      INSERT INTO users (username, email, password_hash, display_name, role)
      VALUES (?, ?, ?, ?, ?)
    `);
    const insertResult = stmt.run(username, email, passwordHash, displayName || username, role);
    const userId = insertResult.lastInsertRowid as number;

    // Generate tokens
    const accessToken = generateAccessToken(userId, role);
    const refreshToken = generateRefreshToken(userId);

    // Store refresh token
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    db.prepare('INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)')
      .run(userId, refreshToken, expiresAt);

    // Set httpOnly cookie for refresh token
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.COOKIE_SECURE === 'true',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.status(201).json({
      accessToken,
      user: {
        id: userId,
        username,
        email,
        displayName: displayName || username,
        role
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
}

export async function login(req: Request, res: Response) {
  try {
    const result = loginSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ error: 'Invalid input', details: result.error.errors });
      return;
    }

    const { email, password } = result.data;

    // Find user
    const user = db.prepare(`
      SELECT id, username, email, password_hash, display_name, role, theme_preference
      FROM users WHERE email = ?
    `).get(email) as any;

    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Verify password
    const validPassword = await verifyPassword(password, user.password_hash);
    if (!validPassword) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Generate tokens
    const accessToken = generateAccessToken(user.id, user.role);
    const refreshToken = generateRefreshToken(user.id);

    // Store refresh token
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    db.prepare('INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)')
      .run(user.id, refreshToken, expiresAt);

    // Set httpOnly cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.COOKIE_SECURE === 'true',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({
      accessToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.display_name,
        role: user.role,
        themePreference: user.theme_preference
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
}

export async function refresh(req: Request, res: Response) {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      res.status(401).json({ error: 'No refresh token' });
      return;
    }

    // Verify token exists in database
    const storedToken = db.prepare(`
      SELECT user_id FROM refresh_tokens
      WHERE token = ? AND expires_at > datetime('now')
    `).get(refreshToken) as any;

    if (!storedToken) {
      res.status(401).json({ error: 'Invalid refresh token' });
      return;
    }

    // Verify JWT
    const decoded = verifyRefreshToken(refreshToken);

    // Get user
    const user = db.prepare('SELECT id, role FROM users WHERE id = ?').get(decoded.userId) as any;
    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    // Generate new access token
    const accessToken = generateAccessToken(user.id, user.role);

    res.json({ accessToken });
  } catch (error) {
    console.error('Refresh error:', error);
    res.status(401).json({ error: 'Invalid refresh token' });
  }
}

export async function logout(req: Request, res: Response) {
  const refreshToken = req.cookies.refreshToken;

  if (refreshToken) {
    db.prepare('DELETE FROM refresh_tokens WHERE token = ?').run(refreshToken);
  }

  res.clearCookie('refreshToken');
  res.json({ message: 'Logged out successfully' });
}

export async function getMe(req: Request, res: Response) {
  try {
    const user = db.prepare(`
      SELECT id, username, email, display_name, role, theme_preference, created_at
      FROM users WHERE id = ?
    `).get(req.user!.userId) as any;

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
    console.error('Get me error:', error);
    res.status(500).json({ error: 'Failed to get user info' });
  }
}

export async function updateTheme(req: Request, res: Response) {
  try {
    const { theme } = req.body;
    const validThemes = ['light', 'dark', 'dracula', 'solarized', 'nord'];

    if (!validThemes.includes(theme)) {
      res.status(400).json({ error: 'Invalid theme' });
      return;
    }

    db.prepare('UPDATE users SET theme_preference = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(theme, req.user!.userId);

    res.json({ theme });
  } catch (error) {
    console.error('Update theme error:', error);
    res.status(500).json({ error: 'Failed to update theme' });
  }
}
