import { Request, Response } from 'express';
import { db } from '../database/db.js';

/**
 * Get a system setting value
 */
export function getSetting(key: string): string | null {
  const row = db.prepare('SELECT value FROM system_settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

/**
 * Set a system setting value
 */
export function setSetting(key: string, value: string): void {
  db.prepare(`
    INSERT INTO system_settings (key, value, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = CURRENT_TIMESTAMP
  `).run(key, value, value);
}

/**
 * Check if registration is enabled
 */
export function isRegistrationEnabled(): boolean {
  const value = getSetting('registration_enabled');
  return value === 'true';
}

/**
 * API: Get registration status (public - needed for login page)
 */
export async function getRegistrationStatus(req: Request, res: Response) {
  try {
    const enabled = isRegistrationEnabled();
    res.json({ registrationEnabled: enabled });
  } catch (error) {
    console.error('Get registration status error:', error);
    res.status(500).json({ error: 'Failed to get registration status' });
  }
}

/**
 * API: Get all system settings (admin only)
 */
export async function getSystemSettings(req: Request, res: Response) {
  try {
    const settings = db.prepare('SELECT key, value FROM system_settings').all() as { key: string; value: string }[];

    const settingsObj: Record<string, string> = {};
    for (const s of settings) {
      settingsObj[s.key] = s.value;
    }

    res.json(settingsObj);
  } catch (error) {
    console.error('Get system settings error:', error);
    res.status(500).json({ error: 'Failed to get system settings' });
  }
}

/**
 * API: Update a system setting (admin only)
 */
export async function updateSystemSetting(req: Request, res: Response) {
  try {
    const { key, value } = req.body;

    if (!key || value === undefined) {
      res.status(400).json({ error: 'Key and value are required' });
      return;
    }

    // Validate allowed keys
    const allowedKeys = ['registration_enabled'];
    if (!allowedKeys.includes(key)) {
      res.status(400).json({ error: 'Invalid setting key' });
      return;
    }

    setSetting(key, String(value));
    res.json({ success: true, key, value: String(value) });
  } catch (error) {
    console.error('Update system setting error:', error);
    res.status(500).json({ error: 'Failed to update system setting' });
  }
}
