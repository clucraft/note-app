import { Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../database/db.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt.js';
import { verifyTOTP } from './twofa.controller.js';
import { isRegistrationEnabled } from './settings.controller.js';

// Validation schemas
const registerSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email(),
  password: z.string().min(6),
  displayName: z.string().optional()
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  totpCode: z.string().length(6).optional()
});

export async function register(req: Request, res: Response) {
  try {
    // Check if registration is enabled (always allow if no users exist - first user setup)
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
    if (userCount.count > 0 && !isRegistrationEnabled()) {
      res.status(403).json({ error: 'Registration is currently disabled' });
      return;
    }

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

    // First user becomes admin (userCount already checked above)
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

    const { email, password, totpCode } = result.data;

    // Find user
    const user = db.prepare(`
      SELECT id, username, email, password_hash, display_name, role, theme_preference, language, timezone, profile_picture, custom_colors, totp_enabled, totp_secret
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

    // Check if 2FA is enabled
    if (user.totp_enabled && user.totp_secret) {
      // 2FA is required
      if (!totpCode) {
        // Return that 2FA is required (don't issue tokens yet)
        res.json({
          requiresTwoFactor: true,
          message: 'Please enter your 2FA code'
        });
        return;
      }

      // Verify TOTP code
      const isValidCode = verifyTOTP(user.totp_secret, totpCode);
      if (!isValidCode) {
        res.status(401).json({ error: 'Invalid 2FA code' });
        return;
      }
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
        themePreference: user.theme_preference,
        language: user.language || 'en-US',
        timezone: user.timezone || 'UTC',
        profilePicture: user.profile_picture,
        customColors: user.custom_colors ? JSON.parse(user.custom_colors) : null
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
      SELECT id, username, email, display_name, role, theme_preference, language, timezone, profile_picture, custom_colors, created_at
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
      language: user.language || 'en-US',
      timezone: user.timezone || 'UTC',
      profilePicture: user.profile_picture,
      customColors: user.custom_colors ? JSON.parse(user.custom_colors) : null,
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

const updatePreferencesSchema = z.object({
  language: z.string().optional(),
  timezone: z.string().optional()
});

export async function updatePreferences(req: Request, res: Response) {
  try {
    const result = updatePreferencesSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ error: 'Invalid input', details: result.error.errors });
      return;
    }

    const { language, timezone } = result.data;
    const validLanguages = ['en-US', 'zh-CN', 'hi-IN', 'es-ES', 'ar-SA'];

    if (language && !validLanguages.includes(language)) {
      res.status(400).json({ error: 'Invalid language' });
      return;
    }

    const updates: string[] = ['updated_at = CURRENT_TIMESTAMP'];
    const params: any[] = [];

    if (language) {
      updates.push('language = ?');
      params.push(language);
    }
    if (timezone) {
      updates.push('timezone = ?');
      params.push(timezone);
    }

    params.push(req.user!.userId);

    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    // Return updated preferences
    const user = db.prepare('SELECT language, timezone FROM users WHERE id = ?')
      .get(req.user!.userId) as any;

    res.json({
      language: user.language || 'en-US',
      timezone: user.timezone || 'UTC'
    });
  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
}

const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(6).optional(),
  profilePicture: z.string().nullable().optional()
});

export async function updateProfile(req: Request, res: Response) {
  try {
    const result = updateProfileSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ error: 'Invalid input', details: result.error.errors });
      return;
    }

    const { displayName, email, currentPassword, newPassword, profilePicture } = result.data;
    const userId = req.user!.userId;

    // Get current user
    const currentUser = db.prepare('SELECT email, password_hash FROM users WHERE id = ?')
      .get(userId) as any;

    if (!currentUser) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // If changing email, check it's not already taken
    if (email && email !== currentUser.email) {
      const existingEmail = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?')
        .get(email, userId);
      if (existingEmail) {
        res.status(400).json({ error: 'Email already in use' });
        return;
      }
    }

    // If changing password, verify current password
    if (newPassword) {
      if (!currentPassword) {
        res.status(400).json({ error: 'Current password is required to change password' });
        return;
      }
      const validPassword = await verifyPassword(currentPassword, currentUser.password_hash);
      if (!validPassword) {
        res.status(400).json({ error: 'Current password is incorrect' });
        return;
      }
    }

    // Build update query
    const updates: string[] = ['updated_at = CURRENT_TIMESTAMP'];
    const params: any[] = [];

    if (displayName !== undefined) {
      updates.push('display_name = ?');
      params.push(displayName);
    }

    if (email !== undefined) {
      updates.push('email = ?');
      params.push(email);
    }

    if (newPassword) {
      const passwordHash = await hashPassword(newPassword);
      updates.push('password_hash = ?');
      params.push(passwordHash);
    }

    if (profilePicture !== undefined) {
      updates.push('profile_picture = ?');
      params.push(profilePicture);
    }

    params.push(userId);

    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    // Return updated user info
    const updatedUser = db.prepare(`
      SELECT id, username, email, display_name, role, theme_preference, language, timezone, profile_picture
      FROM users WHERE id = ?
    `).get(userId) as any;

    res.json({
      id: updatedUser.id,
      username: updatedUser.username,
      email: updatedUser.email,
      displayName: updatedUser.display_name,
      role: updatedUser.role,
      themePreference: updatedUser.theme_preference,
      language: updatedUser.language || 'en-US',
      timezone: updatedUser.timezone || 'UTC',
      profilePicture: updatedUser.profile_picture
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
}

const customColorsSchema = z.object({
  editorBg: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().nullable(),
  textPrimary: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().nullable(),
  colorPrimary: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().nullable(),
  bgSurface: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().nullable()
}).nullable();

export async function updateCustomColors(req: Request, res: Response) {
  try {
    const result = customColorsSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ error: 'Invalid input', details: result.error.errors });
      return;
    }

    const customColors = result.data;
    const userId = req.user!.userId;

    // If all values are null/undefined or object is null, clear custom colors
    const hasAnyColor = customColors && Object.values(customColors).some(v => v != null);
    const colorJson = hasAnyColor ? JSON.stringify(customColors) : null;

    db.prepare('UPDATE users SET custom_colors = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(colorJson, userId);

    res.json({ customColors: hasAnyColor ? customColors : null });
  } catch (error) {
    console.error('Update custom colors error:', error);
    res.status(500).json({ error: 'Failed to update custom colors' });
  }
}
