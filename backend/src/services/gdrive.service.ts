import { google, drive_v3 } from 'googleapis';
import { Readable } from 'stream';

interface ServiceAccountKey {
  client_email: string;
  private_key: string;
  [key: string]: any;
}

export function createDriveClient(serviceAccountJson: string): drive_v3.Drive {
  const key: ServiceAccountKey = JSON.parse(serviceAccountJson);
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: key.client_email,
      private_key: key.private_key,
    },
    scopes: ['https://www.googleapis.com/auth/drive'],
  });

  return google.drive({ version: 'v3', auth });
}

export async function testDriveConnection(serviceAccountJson: string, folderId: string): Promise<{ success: boolean; email: string }> {
  const key: ServiceAccountKey = JSON.parse(serviceAccountJson);
  const drive = createDriveClient(serviceAccountJson);

  // Try to access the folder
  await drive.files.get({
    fileId: folderId,
    fields: 'id,name',
    supportsAllDrives: true,
  });

  return { success: true, email: key.client_email };
}

export async function uploadBackup(
  serviceAccountJson: string,
  folderId: string,
  fileName: string,
  buffer: Buffer
): Promise<{ fileId: string; name: string }> {
  const drive = createDriveClient(serviceAccountJson);

  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);

  const response = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId],
      mimeType: 'application/zip',
    },
    media: {
      mimeType: 'application/zip',
      body: stream,
    },
    fields: 'id,name',
    supportsAllDrives: true,
  });

  return {
    fileId: response.data.id!,
    name: response.data.name!,
  };
}

export interface DriveBackupFile {
  id: string;
  name: string;
  size: string;
  createdTime: string;
}

export async function listBackups(serviceAccountJson: string, folderId: string): Promise<DriveBackupFile[]> {
  const drive = createDriveClient(serviceAccountJson);

  const response = await drive.files.list({
    q: `'${folderId}' in parents and mimeType='application/zip' and trashed=false`,
    fields: 'files(id,name,size,createdTime)',
    orderBy: 'createdTime desc',
    pageSize: 100,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  return (response.data.files || []).map((f) => ({
    id: f.id!,
    name: f.name!,
    size: f.size || '0',
    createdTime: f.createdTime!,
  }));
}

export async function downloadBackup(serviceAccountJson: string, fileId: string): Promise<Buffer> {
  const drive = createDriveClient(serviceAccountJson);

  const response = await drive.files.get(
    { fileId, alt: 'media', supportsAllDrives: true },
    { responseType: 'arraybuffer' }
  );

  return Buffer.from(response.data as ArrayBuffer);
}

export async function deleteBackup(serviceAccountJson: string, fileId: string): Promise<void> {
  const drive = createDriveClient(serviceAccountJson);
  await drive.files.delete({ fileId, supportsAllDrives: true });
}

export async function enforceRetention(
  serviceAccountJson: string,
  folderId: string,
  maxBackups: number
): Promise<number> {
  const backups = await listBackups(serviceAccountJson, folderId);

  if (backups.length <= maxBackups) return 0;

  const toDelete = backups.slice(maxBackups);
  let deleted = 0;

  for (const backup of toDelete) {
    try {
      await deleteBackup(serviceAccountJson, backup.id);
      deleted++;
    } catch (err) {
      console.error(`Failed to delete old backup ${backup.name}:`, err);
    }
  }

  return deleted;
}
