import { api } from './index';

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

export interface DriveBackupFile {
  id: string;
  name: string;
  size: string;
  createdTime: string;
}

export async function getBackupConfig(): Promise<BackupConfig> {
  const response = await api.get<BackupConfig>('/backups/config');
  return response.data;
}

export async function updateBackupConfig(config: Partial<Pick<BackupConfig, 'enabled' | 'intervalHours' | 'maxRetention' | 'folderId'>>): Promise<BackupConfig> {
  const response = await api.put<BackupConfig>('/backups/config', config);
  return response.data;
}

export async function uploadGdriveKey(serviceAccountJson: string): Promise<{ success: boolean; clientEmail: string }> {
  const response = await api.put('/backups/gdrive-key', { serviceAccountJson });
  return response.data;
}

export async function deleteGdriveKey(): Promise<void> {
  await api.delete('/backups/gdrive-key');
}

export async function testDriveConnection(): Promise<{ success: boolean; email: string }> {
  const response = await api.post('/backups/test-connection');
  return response.data;
}

export async function triggerBackup(): Promise<{ success: boolean; timestamp: string }> {
  const response = await api.post('/backups/trigger');
  return response.data;
}

export async function listDriveBackups(): Promise<DriveBackupFile[]> {
  const response = await api.get<DriveBackupFile[]>('/backups/list');
  return response.data;
}

export async function downloadBackupFromDrive(fileId: string, fileName: string): Promise<void> {
  const response = await api.post(`/backups/download/${fileId}`, null, {
    responseType: 'blob',
  });
  const blob = new Blob([response.data], { type: 'application/zip' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

export async function restoreFromDrive(fileId: string): Promise<{ success: boolean; message: string }> {
  const response = await api.post(`/backups/restore/${fileId}`);
  return response.data;
}

export async function restoreFromUpload(file: File): Promise<{ success: boolean; message: string }> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post('/backups/restore-upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
}
