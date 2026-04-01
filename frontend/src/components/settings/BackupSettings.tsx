import { useState, useEffect, useRef } from 'react';
import {
  getBackupConfig,
  updateBackupConfig,
  uploadGdriveKey,
  deleteGdriveKey,
  testDriveConnection,
  triggerBackup,
  listDriveBackups,
  downloadBackupFromDrive,
  restoreFromDrive,
  restoreFromUpload,
} from '../../api/backup.api';
import type { BackupConfig, DriveBackupFile } from '../../api/backup.api';
import { Modal } from '../common/Modal';
import styles from './BackupSettings.module.css';

export function BackupSettings() {
  const [config, setConfig] = useState<BackupConfig | null>(null);
  const [backups, setBackups] = useState<DriveBackupFile[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);

  // Form state
  const [keyInput, setKeyInput] = useState('');
  const [folderIdInput, setFolderIdInput] = useState('');
  const [intervalInput, setIntervalInput] = useState(24);
  const [retentionInput, setRetentionInput] = useState(50);

  // Loading states
  const [savingKey, setSavingKey] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [triggeringBackup, setTriggeringBackup] = useState(false);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [restoringUpload, setRestoringUpload] = useState(false);

  // Modal
  const [restoreModal, setRestoreModal] = useState<{ type: 'drive'; fileId: string; fileName: string } | { type: 'upload'; file: File } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const data = await getBackupConfig();
      setConfig(data);
      setFolderIdInput(data.folderId);
      setIntervalInput(data.intervalHours);
      setRetentionInput(data.maxRetention);
    } catch (err) {
      console.error('Failed to load backup config:', err);
      setError('Failed to load backup configuration');
    } finally {
      setLoading(false);
    }
  };

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setError('');
    setTimeout(() => setSuccess(''), 3000);
  };

  const showError = (msg: string) => {
    setError(msg);
    setSuccess('');
  };

  const handleSaveKey = async () => {
    if (!keyInput.trim()) return;
    setSavingKey(true);
    setError('');
    try {
      const result = await uploadGdriveKey(keyInput.trim());
      showSuccess(`Service account key saved (${result.clientEmail})`);
      setKeyInput('');
      await loadConfig();
    } catch (err: any) {
      showError(err.response?.data?.error || 'Failed to save key');
    } finally {
      setSavingKey(false);
    }
  };

  const handleRemoveKey = async () => {
    if (!confirm('Remove the service account key? This will disable automatic backups.')) return;
    try {
      await deleteGdriveKey();
      showSuccess('Service account key removed');
      await loadConfig();
    } catch (err: any) {
      showError(err.response?.data?.error || 'Failed to remove key');
    }
  };

  const handleSaveFolderId = async () => {
    try {
      const updated = await updateBackupConfig({ folderId: folderIdInput.trim() });
      setConfig(updated);
      showSuccess('Folder ID saved');
    } catch (err: any) {
      showError(err.response?.data?.error || 'Failed to save folder ID');
    }
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setError('');
    try {
      const result = await testDriveConnection();
      showSuccess(`Connection successful! Authenticated as ${result.email}`);
    } catch (err: any) {
      showError(err.response?.data?.error || 'Connection test failed');
    } finally {
      setTestingConnection(false);
    }
  };

  const handleToggleEnabled = async () => {
    if (!config) return;
    try {
      const updated = await updateBackupConfig({ enabled: !config.enabled });
      setConfig(updated);
    } catch (err: any) {
      showError(err.response?.data?.error || 'Failed to update setting');
    }
  };

  const handleSaveSchedule = async () => {
    try {
      const updated = await updateBackupConfig({
        intervalHours: intervalInput,
        maxRetention: retentionInput,
      });
      setConfig(updated);
      showSuccess('Schedule settings saved');
    } catch (err: any) {
      showError(err.response?.data?.error || 'Failed to save schedule');
    }
  };

  const handleTriggerBackup = async () => {
    setTriggeringBackup(true);
    setError('');
    try {
      await triggerBackup();
      showSuccess('Backup completed successfully');
      await loadConfig();
      await handleLoadBackups();
    } catch (err: any) {
      showError(err.response?.data?.error || 'Backup failed');
    } finally {
      setTriggeringBackup(false);
    }
  };

  const handleLoadBackups = async () => {
    setLoadingBackups(true);
    try {
      const list = await listDriveBackups();
      setBackups(list);
    } catch (err: any) {
      console.error('Failed to load backups:', err);
    } finally {
      setLoadingBackups(false);
    }
  };

  const handleDownload = async (fileId: string, fileName: string) => {
    try {
      await downloadBackupFromDrive(fileId, fileName);
    } catch (err: any) {
      showError(err.response?.data?.error || 'Download failed');
    }
  };

  const handleRestoreConfirm = async () => {
    if (!restoreModal) return;

    if (restoreModal.type === 'drive') {
      setRestoringId(restoreModal.fileId);
      try {
        await restoreFromDrive(restoreModal.fileId);
        showSuccess('Restore completed successfully. Please reload the page.');
        await loadConfig();
      } catch (err: any) {
        showError(err.response?.data?.error || 'Restore failed');
      } finally {
        setRestoringId(null);
      }
    } else {
      setRestoringUpload(true);
      try {
        await restoreFromUpload(restoreModal.file);
        showSuccess('Restore completed successfully. Please reload the page.');
        await loadConfig();
      } catch (err: any) {
        showError(err.response?.data?.error || 'Restore failed');
      } finally {
        setRestoringUpload(false);
      }
    }

    setRestoreModal(null);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRestoreModal({ type: 'upload', file });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const formatSize = (bytes: string) => {
    const b = parseInt(bytes, 10);
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr || dateStr === 'pending') return dateStr || 'N/A';
    return new Date(dateStr).toLocaleString();
  };

  if (loading) {
    return <div className={styles.container}>Loading...</div>;
  }

  const driveConfigured = config?.hasGdriveKey && config?.folderId;

  return (
    <div className={styles.container}>
      <h2 className={styles.sectionTitle}>Backups</h2>
      <p className={styles.subtitle}>
        Configure automatic backups to Google Drive and restore from previous backups.
      </p>

      {error && <div className={styles.error}>{error}</div>}
      {success && <div className={styles.success}>{success}</div>}

      {/* Section 1: Google Drive Connection */}
      <div className={styles.section}>
        <h3 className={styles.label}>Google Drive Connection</h3>
        <p className={styles.description}>
          Upload a Google Cloud service account JSON key to enable Drive backups.
        </p>

        {config?.hasGdriveKey ? (
          <div>
            <span className={`${styles.statusBadge} ${styles.statusConnected}`}>
              Connected
            </span>
            <div className={styles.buttonGroup}>
              <button className={styles.dangerButton} onClick={handleRemoveKey}>
                Remove Key
              </button>
            </div>
          </div>
        ) : (
          <div>
            <span className={`${styles.statusBadge} ${styles.statusDisconnected}`}>
              Not configured
            </span>
            <textarea
              className={styles.textarea}
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder='Paste service account JSON key here...'
            />
            <div className={styles.buttonGroup}>
              <button
                className={styles.button}
                onClick={handleSaveKey}
                disabled={savingKey || !keyInput.trim()}
              >
                {savingKey ? 'Saving...' : 'Save Key'}
              </button>
            </div>
          </div>
        )}

        <div style={{ marginTop: '1rem' }}>
          <p className={styles.description}>Google Drive Folder ID</p>
          <div className={styles.inputGroup}>
            <input
              type="text"
              className={styles.input}
              value={folderIdInput}
              onChange={(e) => setFolderIdInput(e.target.value)}
              placeholder="Folder ID from Drive URL"
            />
            <button
              className={styles.button}
              onClick={handleSaveFolderId}
              disabled={!folderIdInput.trim()}
            >
              Save
            </button>
          </div>
        </div>

        {config?.hasGdriveKey && config?.folderId && (
          <div className={styles.buttonGroup}>
            <button
              className={styles.button}
              onClick={handleTestConnection}
              disabled={testingConnection}
            >
              {testingConnection ? 'Testing...' : 'Test Connection'}
            </button>
          </div>
        )}

        <div className={styles.info}>
          <span className={styles.infoIcon}>i</span>
          <span>
            Share your Google Drive folder with the service account email address
            (found in your JSON key as <code>client_email</code>) and give it Editor access.
          </span>
        </div>
      </div>

      <hr className={styles.divider} />

      {/* Section 2: Schedule */}
      <div className={styles.section}>
        <h3 className={styles.label}>Schedule</h3>

        <div className={styles.toggleRow}>
          <input
            type="checkbox"
            id="backup-enabled"
            checked={config?.enabled || false}
            onChange={handleToggleEnabled}
            disabled={!driveConfigured}
          />
          <label htmlFor="backup-enabled">Enable automatic backups</label>
        </div>

        <div className={styles.fieldRow}>
          <label>Backup every</label>
          <input
            type="number"
            className={styles.numberInput}
            value={intervalInput}
            onChange={(e) => setIntervalInput(Math.max(1, Math.min(720, parseInt(e.target.value) || 1)))}
            min={1}
            max={720}
          />
          <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>hours</span>
        </div>

        <div className={styles.fieldRow}>
          <label>Keep last</label>
          <input
            type="number"
            className={styles.numberInput}
            value={retentionInput}
            onChange={(e) => setRetentionInput(Math.max(1, Math.min(1000, parseInt(e.target.value) || 1)))}
            min={1}
            max={1000}
          />
          <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>backups</span>
        </div>

        <div className={styles.buttonGroup}>
          <button className={styles.button} onClick={handleSaveSchedule}>
            Save Schedule
          </button>
        </div>

        {config && (
          <div style={{ marginTop: '0.75rem' }}>
            <div className={styles.statusRow}>
              <strong>Last backup:</strong> {formatDate(config.lastTimestamp)}
            </div>
            <div className={styles.statusRow}>
              <strong>Next backup:</strong> {formatDate(config.nextBackupTime)}
            </div>
            {config.lastError && (
              <div className={styles.statusRow}>
                <strong>Last error:</strong> <span style={{ color: 'var(--color-danger)' }}>{config.lastError}</span>
              </div>
            )}
          </div>
        )}
      </div>

      <hr className={styles.divider} />

      {/* Section 3: Manual Backup */}
      <div className={styles.section}>
        <h3 className={styles.label}>Manual Backup</h3>
        <p className={styles.description}>
          Create a backup immediately and upload it to Google Drive.
        </p>
        <button
          className={styles.button}
          onClick={handleTriggerBackup}
          disabled={triggeringBackup || !driveConfigured}
        >
          {triggeringBackup ? 'Backing up...' : 'Backup Now'}
        </button>
      </div>

      <hr className={styles.divider} />

      {/* Section 4: Backup History */}
      <div className={styles.section}>
        <h3 className={styles.label}>Backup History</h3>
        <p className={styles.description}>
          View and manage backups stored in Google Drive.
        </p>
        <button
          className={styles.button}
          onClick={handleLoadBackups}
          disabled={loadingBackups || !driveConfigured}
        >
          {loadingBackups ? 'Loading...' : 'Load Backups'}
        </button>

        {backups.length > 0 ? (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Size</th>
                <th>Date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {backups.map((b) => (
                <tr key={b.id}>
                  <td>{b.name}</td>
                  <td>{formatSize(b.size)}</td>
                  <td>{formatDate(b.createdTime)}</td>
                  <td>
                    <div className={styles.actionButtons}>
                      <button
                        className={styles.smallButton}
                        onClick={() => handleDownload(b.id, b.name)}
                      >
                        Download
                      </button>
                      <button
                        className={styles.smallDangerButton}
                        onClick={() => setRestoreModal({ type: 'drive', fileId: b.id, fileName: b.name })}
                        disabled={restoringId === b.id}
                      >
                        {restoringId === b.id ? 'Restoring...' : 'Restore'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          !loadingBackups && driveConfigured && (
            <div className={styles.emptyState}>No backups found. Click "Load Backups" to check.</div>
          )
        )}
      </div>

      <hr className={styles.divider} />

      {/* Section 5: Upload Restore */}
      <div className={styles.section}>
        <h3 className={styles.label}>Restore from File</h3>
        <p className={styles.description}>
          Upload a backup ZIP file to restore. Useful for fresh instances without Google Drive.
        </p>
        <input
          ref={fileInputRef}
          type="file"
          className={styles.fileInput}
          accept=".zip"
          onChange={handleFileSelect}
        />
      </div>

      {/* Restore confirmation modal */}
      <Modal
        isOpen={!!restoreModal}
        onClose={() => setRestoreModal(null)}
        title="Confirm Restore"
        size="sm"
      >
        <div className={styles.modalBody}>
          <p>
            This will replace <strong>all current data</strong> (notes, uploads, settings) with the backup contents.
            This action cannot be undone.
          </p>
          {restoreModal?.type === 'drive' && (
            <p>Restoring from: <strong>{restoreModal.fileName}</strong></p>
          )}
          {restoreModal?.type === 'upload' && (
            <p>Restoring from: <strong>{restoreModal.file.name}</strong></p>
          )}
        </div>
        <div className={styles.modalActions}>
          <button className={styles.cancelButton} onClick={() => setRestoreModal(null)}>
            Cancel
          </button>
          <button
            className={styles.confirmDangerButton}
            onClick={handleRestoreConfirm}
            disabled={restoringId !== null || restoringUpload}
          >
            {restoringId || restoringUpload ? 'Restoring...' : 'Restore'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
