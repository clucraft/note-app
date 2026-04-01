import { Request, Response } from 'express';
import { getSetting, setSetting } from './settings.controller.js';
import { encrypt, decrypt } from '../utils/crypto.js';
import { testDriveConnection, listBackups, downloadBackup } from '../services/gdrive.service.js';
import { createBackupZip, restoreFromZip } from '../services/backup.service.js';
import { getBackupConfig, runBackup, restartScheduler } from '../services/backup.scheduler.js';

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

export async function uploadGdriveKey(req: Request, res: Response) {
  try {
    const { serviceAccountJson } = req.body;
    if (!serviceAccountJson) {
      res.status(400).json({ error: 'Service account JSON is required' });
      return;
    }

    // Validate JSON
    let parsed: any;
    try {
      parsed = JSON.parse(serviceAccountJson);
    } catch {
      res.status(400).json({ error: 'Invalid JSON format' });
      return;
    }

    if (!parsed.client_email || !parsed.private_key) {
      res.status(400).json({ error: 'Invalid service account key: missing client_email or private_key' });
      return;
    }

    const encrypted = encrypt(serviceAccountJson);
    setSetting('backup_gdrive_key', encrypted);

    res.json({ success: true, clientEmail: parsed.client_email });
  } catch (error: any) {
    console.error('Upload GDrive key error:', error);
    res.status(500).json({ error: 'Failed to save service account key' });
  }
}

export async function deleteGdriveKey(req: Request, res: Response) {
  try {
    setSetting('backup_enabled', 'false');
    setSetting('backup_gdrive_key', '');
    restartScheduler();
    res.json({ success: true });
  } catch (error: any) {
    console.error('Delete GDrive key error:', error);
    res.status(500).json({ error: 'Failed to remove service account key' });
  }
}

export async function testConnection(req: Request, res: Response) {
  try {
    const encryptedKey = getSetting('backup_gdrive_key');
    const folderId = getSetting('backup_gdrive_folder_id');

    if (!encryptedKey) {
      res.status(400).json({ error: 'No service account key configured' });
      return;
    }
    if (!folderId) {
      res.status(400).json({ error: 'No folder ID configured' });
      return;
    }

    const serviceAccountJson = decrypt(encryptedKey);
    const result = await testDriveConnection(serviceAccountJson, folderId);
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
    const encryptedKey = getSetting('backup_gdrive_key');
    const folderId = getSetting('backup_gdrive_folder_id');

    if (!encryptedKey || !folderId) {
      res.status(400).json({ error: 'Google Drive not configured' });
      return;
    }

    const serviceAccountJson = decrypt(encryptedKey);
    const backups = await listBackups(serviceAccountJson, folderId);
    res.json(backups);
  } catch (error: any) {
    console.error('List backups error:', error);
    res.status(500).json({ error: error.message || 'Failed to list backups' });
  }
}

export async function downloadBackupHandler(req: Request, res: Response) {
  try {
    const { fileId } = req.params;
    const encryptedKey = getSetting('backup_gdrive_key');

    if (!encryptedKey) {
      res.status(400).json({ error: 'Google Drive not configured' });
      return;
    }

    const serviceAccountJson = decrypt(encryptedKey);
    const buffer = await downloadBackup(serviceAccountJson, fileId);

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
    const encryptedKey = getSetting('backup_gdrive_key');

    if (!encryptedKey) {
      res.status(400).json({ error: 'Google Drive not configured' });
      return;
    }

    const serviceAccountJson = decrypt(encryptedKey);
    const buffer = await downloadBackup(serviceAccountJson, fileId);
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
