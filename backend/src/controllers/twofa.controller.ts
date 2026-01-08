import { Request, Response } from 'express';
import { z } from 'zod';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import { db } from '../database/db.js';

const APP_NAME = 'Cache Notes';

// Get 2FA status for current user
export async function getTwoFAStatus(req: Request, res: Response) {
  try {
    const userId = req.user!.userId;

    const user = db.prepare('SELECT totp_enabled FROM users WHERE id = ?')
      .get(userId) as { totp_enabled: number } | undefined;

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ enabled: !!user.totp_enabled });
  } catch (error) {
    console.error('Get 2FA status error:', error);
    res.status(500).json({ error: 'Failed to get 2FA status' });
  }
}

// Generate new TOTP secret and QR code for setup
export async function setupTwoFA(req: Request, res: Response) {
  try {
    const userId = req.user!.userId;

    // Get user info
    const user = db.prepare('SELECT email, totp_enabled FROM users WHERE id = ?')
      .get(userId) as { email: string; totp_enabled: number } | undefined;

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (user.totp_enabled) {
      res.status(400).json({ error: '2FA is already enabled. Disable it first to set up again.' });
      return;
    }

    // Generate new secret
    const secret = authenticator.generateSecret();

    // Store secret temporarily (not enabled yet)
    db.prepare('UPDATE users SET totp_secret = ? WHERE id = ?')
      .run(secret, userId);

    // Generate otpauth URL
    const otpauthUrl = authenticator.keyuri(user.email, APP_NAME, secret);

    // Generate QR code as data URL
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

    res.json({
      secret,
      qrCode: qrCodeDataUrl,
      otpauthUrl
    });
  } catch (error) {
    console.error('Setup 2FA error:', error);
    res.status(500).json({ error: 'Failed to setup 2FA' });
  }
}

const verifySchema = z.object({
  code: z.string().length(6)
});

// Verify TOTP code and enable 2FA
export async function enableTwoFA(req: Request, res: Response) {
  try {
    const userId = req.user!.userId;

    const result = verifySchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ error: 'Invalid code format. Must be 6 digits.' });
      return;
    }

    const { code } = result.data;

    // Get user's secret
    const user = db.prepare('SELECT totp_secret, totp_enabled FROM users WHERE id = ?')
      .get(userId) as { totp_secret: string | null; totp_enabled: number } | undefined;

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (!user.totp_secret) {
      res.status(400).json({ error: 'Please set up 2FA first by generating a QR code.' });
      return;
    }

    if (user.totp_enabled) {
      res.status(400).json({ error: '2FA is already enabled.' });
      return;
    }

    // Verify the code
    const isValid = authenticator.verify({ token: code, secret: user.totp_secret });

    if (!isValid) {
      res.status(400).json({ error: 'Invalid verification code. Please try again.' });
      return;
    }

    // Enable 2FA
    db.prepare('UPDATE users SET totp_enabled = 1 WHERE id = ?')
      .run(userId);

    res.json({ success: true, message: '2FA has been enabled successfully.' });
  } catch (error) {
    console.error('Enable 2FA error:', error);
    res.status(500).json({ error: 'Failed to enable 2FA' });
  }
}

// Disable 2FA (requires current password)
const disableSchema = z.object({
  code: z.string().length(6)
});

export async function disableTwoFA(req: Request, res: Response) {
  try {
    const userId = req.user!.userId;

    const result = disableSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ error: 'Invalid code format. Must be 6 digits.' });
      return;
    }

    const { code } = result.data;

    // Get user's secret
    const user = db.prepare('SELECT totp_secret, totp_enabled FROM users WHERE id = ?')
      .get(userId) as { totp_secret: string | null; totp_enabled: number } | undefined;

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (!user.totp_enabled || !user.totp_secret) {
      res.status(400).json({ error: '2FA is not enabled.' });
      return;
    }

    // Verify the code
    const isValid = authenticator.verify({ token: code, secret: user.totp_secret });

    if (!isValid) {
      res.status(400).json({ error: 'Invalid verification code.' });
      return;
    }

    // Disable 2FA and clear secret
    db.prepare('UPDATE users SET totp_enabled = 0, totp_secret = NULL WHERE id = ?')
      .run(userId);

    res.json({ success: true, message: '2FA has been disabled.' });
  } catch (error) {
    console.error('Disable 2FA error:', error);
    res.status(500).json({ error: 'Failed to disable 2FA' });
  }
}

// Verify 2FA code during login (called from auth controller)
export function verifyTOTP(secret: string, code: string): boolean {
  return authenticator.verify({ token: code, secret });
}
