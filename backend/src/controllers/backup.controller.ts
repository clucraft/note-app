import crypto from 'crypto';
import { Request, Response } from 'express';
import { getSetting, setSetting } from './settings.controller.js';
import { encrypt, decrypt } from '../utils/crypto.js';
import { testDriveConnection, listBackups, downloadBackup, generateAuthUrl, exchangeCodeForTokens } from '../services/gdrive.service.js';
import { createBackupZip, restoreFromZip } from '../services/backup.service.js';
import { getBackupConfig, getOAuthCredentials, runBackup, restartScheduler } from '../services/backup.scheduler.js';

export async function getConfig(req: Request, res: Response) {
  try {
    const config = getBackupConfig();
    res.json(config);
  } catch (error: any) {
    console.error('Get backup config error:', error);
    res.status(500).json({ error: 'Failed to get backup configuration' });
  }
}

export async function updateConfig(req: Request, res: Response) {
  try {
    const { enabled, intervalHours, maxRetention, folderId } = req.body;

    if (enabled !== undefined) {
      setSetting('backup_enabled', String(enabled));
    }
    if (intervalHours !== undefined) {
      const hours = Math.max(1, Math.min(720, parseInt(intervalHours, 10)));
      setSetting('backup_interval_hours', String(hours));
    }
    if (maxRetention !== undefined) {
      const max = Math.max(1, Math.min(1000, parseInt(maxRetention, 10)));
      setSetting('backup_max_retention', String(max));
    }
    if (folderId !== undefined) {
      setSetting('backup_gdrive_folder_id', String(folderId));
    }

    restartScheduler();
    res.json(getBackupConfig());
  } catch (error: any) {
    console.error('Update backup config error:', error);
    res.status(500).json({ error: 'Failed to update backup configuration' });
  }
}

export async function saveOAuthClientCredentials(req: Request, res: Response) {
  try {
    const { clientId, clientSecret } = req.body;
    if (!clientId || !clientSecret) {
      res.status(400).json({ error: 'Client ID and Client Secret are required' });
      return;
    }

    setSetting('backup_gdrive_client_id', encrypt(clientId));
    setSetting('backup_gdrive_client_secret', encrypt(clientSecret));
    // Clear any existing refresh token when credentials change
    setSetting('backup_gdrive_refresh_token', '');

    res.json({ success: true });
  } catch (error: any) {
    console.error('Save OAuth credentials error:', error);
    res.status(500).json({ error: 'Failed to save OAuth credentials' });
  }
}

export async function disconnectGdrive(req: Request, res: Response) {
  try {
    setSetting('backup_enabled', 'false');
    setSetting('backup_gdrive_client_id', '');
    setSetting('backup_gdrive_client_secret', '');
    setSetting('backup_gdrive_refresh_token', '');
    setSetting('backup_gdrive_oauth_state', '');
    restartScheduler();
    res.json({ success: true });
  } catch (error: any) {
    console.error('Disconnect GDrive error:', error);
    res.status(500).json({ error: 'Failed to disconnect Google Drive' });
  }
}

export async function getOAuthUrl(req: Request, res: Response) {
  try {
    const encClientId = getSetting('backup_gdrive_client_id');
    const encClientSecret = getSetting('backup_gdrive_client_secret');

    if (!encClientId || !encClientSecret) {
      res.status(400).json({ error: 'OAuth client credentials not configured. Save Client ID and Secret first.' });
      return;
    }

    const clientId = decrypt(encClientId);
    const clientSecret = decrypt(encClientSecret);

    const backendUrl = process.env.BACKEND_PUBLIC_URL;
    if (!backendUrl) {
      res.status(500).json({ error: 'BACKEND_PUBLIC_URL environment variable is not set' });
      return;
    }

    const redirectUri = `${backendUrl}/api/backups/oauth2/callback`;
    const state = crypto.randomBytes(32).toString('hex');
    setSetting('backup_gdrive_oauth_state', state);

    const url = generateAuthUrl(clientId, clientSecret, redirectUri, state);
    res.json({ url });
  } catch (error: any) {
    console.error('Get OAuth URL error:', error);
    res.status(500).json({ error: 'Failed to generate OAuth URL' });
  }
}

export async function oauthCallback(req: Request, res: Response) {
  const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';

  try {
    const { code, state, error: oauthError } = req.query;

    if (oauthError) {
      res.redirect(`${corsOrigin}/settings?gdrive_error=${encodeURIComponent(String(oauthError))}`);
      return;
    }

    if (!code || !state) {
      res.redirect(`${corsOrigin}/settings?gdrive_error=${encodeURIComponent('Missing code or state parameter')}`);
      return;
    }

    // Validate CSRF state
    const storedState = getSetting('backup_gdrive_oauth_state');
    if (!storedState || storedState !== String(state)) {
      res.redirect(`${corsOrigin}/settings?gdrive_error=${encodeURIComponent('Invalid state parameter (CSRF check failed)')}`);
      return;
    }

    // Clear used state
    setSetting('backup_gdrive_oauth_state', '');

    const encClientId = getSetting('backup_gdrive_client_id');
    const encClientSecret = getSetting('backup_gdrive_client_secret');

    if (!encClientId || !encClientSecret) {
      res.redirect(`${corsOrigin}/settings?gdrive_error=${encodeURIComponent('OAuth client credentials not found')}`);
      return;
    }

    const clientId = decrypt(encClientId);
    const clientSecret = decrypt(encClientSecret);

    const backendUrl = process.env.BACKEND_PUBLIC_URL;
    if (!backendUrl) {
      res.redirect(`${corsOrigin}/settings?gdrive_error=${encodeURIComponent('BACKEND_PUBLIC_URL not configured')}`);
      return;
    }

    const redirectUri = `${backendUrl}/api/backups/oauth2/callback`;
    const tokens = await exchangeCodeForTokens(clientId, clientSecret, redirectUri, String(code));

    setSetting('backup_gdrive_refresh_token', encrypt(tokens.refreshToken));

    res.redirect(`${corsOrigin}/settings?gdrive_connected=true`);
  } catch (error: any) {
    console.error('OAuth callback error:', error);
    res.redirect(`${corsOrigin}/settings?gdrive_error=${encodeURIComponent(error.message || 'OAuth callback failed')}`);
  }
}

export async function testConnection(req: Request, res: Response) {
  try {
    const credentials = getOAuthCredentials();
    const folderId = getSetting('backup_gdrive_folder_id');

    if (!folderId) {
      res.status(400).json({ error: 'No folder ID configured' });
      return;
    }

    const result = await testDriveConnection(credentials, folderId);
    res.json(result);
  } catch (error: any) {
    console.error('Test connection error:', error);
    res.status(400).json({ error: error.message || 'Connection test failed' });
  }
}

export async function triggerBackup(req: Request, res: Response) {
  try {
    await runBackup();
    res.json({ success: true, timestamp: new Date().toISOString() });
  } catch (error: any) {
    console.error('Manual backup error:', error);
    res.status(500).json({ error: error.message || 'Backup failed' });
  }
}

export async function listBackupsHandler(req: Request, res: Response) {
  try {
    const credentials = getOAuthCredentials();
    const folderId = getSetting('backup_gdrive_folder_id');

    if (!folderId) {
      res.status(400).json({ error: 'Google Drive not configured' });
      return;
    }

    const backupsList = await listBackups(credentials, folderId);
    res.json(backupsList);
  } catch (error: any) {
    console.error('List backups error:', error);
    res.status(500).json({ error: error.message || 'Failed to list backups' });
  }
}

export async function downloadBackupHandler(req: Request, res: Response) {
  try {
    const { fileId } = req.params;
    const credentials = getOAuthCredentials();

    const buffer = await downloadBackup(credentials, fileId);

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="backup-${fileId}.zip"`);
    res.send(buffer);
  } catch (error: any) {
    console.error('Download backup error:', error);
    res.status(500).json({ error: error.message || 'Failed to download backup' });
  }
}

export async function restoreFromDrive(req: Request, res: Response) {
  try {
    const { fileId } = req.params;
    const credentials = getOAuthCredentials();

    const buffer = await downloadBackup(credentials, fileId);
    await restoreFromZip(buffer);

    res.json({ success: true, message: 'Restore completed successfully' });
  } catch (error: any) {
    console.error('Restore from Drive error:', error);
    res.status(500).json({ error: error.message || 'Restore failed' });
  }
}

export async function restoreFromUpload(req: Request, res: Response) {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    await restoreFromZip(req.file.buffer);
    res.json({ success: true, message: 'Restore completed successfully' });
  } catch (error: any) {
    console.error('Restore from upload error:', error);
    res.status(500).json({ error: error.message || 'Restore failed' });
  }
}
