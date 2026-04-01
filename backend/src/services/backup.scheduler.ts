import cron from 'node-cron';
import { getSetting, setSetting } from '../controllers/settings.controller.js';
import { decrypt } from '../utils/crypto.js';
import { createBackupZip } from './backup.service.js';
import { uploadBackup, enforceRetention } from './gdrive.service.js';

let cronTask: cron.ScheduledTask | null = null;

export interface BackupConfig {
  enabled: boolean;
  intervalHours: number;
  maxRetention: number;
  folderId: string;
  hasGdriveKey: boolean;
  lastTimestamp: string | null;
  lastError: string | null;
  nextBackupTime: string | null;
}

export function getBackupConfig(): BackupConfig {
  const enabled = getSetting('backup_enabled') === 'true';
  const intervalHours = parseInt(getSetting('backup_interval_hours') || '24', 10);
  const maxRetention = parseInt(getSetting('backup_max_retention') || '50', 10);
  const folderId = getSetting('backup_gdrive_folder_id') || '';
  const hasGdriveKey = !!getSetting('backup_gdrive_key');
  const lastTimestamp = getSetting('backup_last_timestamp');
  const lastError = getSetting('backup_last_error');

  let nextBackupTime: string | null = null;
  if (enabled && lastTimestamp) {
    const next = new Date(new Date(lastTimestamp).getTime() + intervalHours * 60 * 60 * 1000);
    nextBackupTime = next.toISOString();
  } else if (enabled) {
    // First backup will happen at next cron tick
    nextBackupTime = 'pending';
  }

  return {
    enabled,
    intervalHours,
    maxRetention,
    folderId,
    hasGdriveKey,
    lastTimestamp,
    lastError,
    nextBackupTime,
  };
}

export async function runBackup(): Promise<void> {
  const encryptedKey = getSetting('backup_gdrive_key');
  const folderId = getSetting('backup_gdrive_folder_id');
  const maxRetention = parseInt(getSetting('backup_max_retention') || '50', 10);

  if (!encryptedKey || !folderId) {
    throw new Error('Google Drive not configured');
  }

  const serviceAccountJson = decrypt(encryptedKey);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `cache-notes-backup-${timestamp}.zip`;

  const zipBuffer = await createBackupZip();
  await uploadBackup(serviceAccountJson, folderId, fileName, zipBuffer);
  await enforceRetention(serviceAccountJson, folderId, maxRetention);

  setSetting('backup_last_timestamp', new Date().toISOString());
  setSetting('backup_last_error', '');
}

function buildCronExpression(intervalHours: number): string {
  if (intervalHours <= 0) return '0 0 * * *'; // fallback: daily
  if (intervalHours < 24) {
    return `0 */${intervalHours} * * *`;
  }
  // For 24+ hours, run daily and check elapsed time in the handler
  return '0 0 * * *';
}

export function startScheduler(): void {
  const config = getBackupConfig();

  if (!config.enabled || !config.hasGdriveKey || !config.folderId) {
    console.log('Backup scheduler: disabled or not configured');
    return;
  }

  stopScheduler();

  const expression = buildCronExpression(config.intervalHours);
  console.log(`Backup scheduler: starting with cron "${expression}" (every ${config.intervalHours}h)`);

  cronTask = cron.schedule(expression, async () => {
    // For intervals > 24h, check if enough time has passed
    if (config.intervalHours > 24) {
      const lastTimestamp = getSetting('backup_last_timestamp');
      if (lastTimestamp) {
        const elapsed = Date.now() - new Date(lastTimestamp).getTime();
        const needed = config.intervalHours * 60 * 60 * 1000;
        if (elapsed < needed) return;
      }
    }

    console.log('Backup scheduler: running scheduled backup...');
    try {
      await runBackup();
      console.log('Backup scheduler: backup completed successfully');
    } catch (err: any) {
      console.error('Backup scheduler: backup failed:', err.message);
      setSetting('backup_last_error', err.message || 'Unknown error');
    }
  });
}

export function stopScheduler(): void {
  if (cronTask) {
    cronTask.stop();
    cronTask = null;
    console.log('Backup scheduler: stopped');
  }
}

export function restartScheduler(): void {
  stopScheduler();
  startScheduler();
}
