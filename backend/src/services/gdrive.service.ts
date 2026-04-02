import { google, drive_v3 } from 'googleapis';
import { Readable } from 'stream';

export interface OAuthCredentials {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

export function createDriveClient(credentials: OAuthCredentials): drive_v3.Drive {
  const oauth2Client = new google.auth.OAuth2(
    credentials.clientId,
    credentials.clientSecret
  );
  oauth2Client.setCredentials({ refresh_token: credentials.refreshToken });

  return google.drive({ version: 'v3', auth: oauth2Client });
}

export function generateAuthUrl(
  clientId: string,
  clientSecret: string,
  redirectUri: string,
  state: string
): string {
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/drive'],
    state,
  });
}

export async function exchangeCodeForTokens(
  clientId: string,
  clientSecret: string,
  redirectUri: string,
  code: string
): Promise<{ refreshToken: string; accessToken: string }> {
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  const { tokens } = await oauth2Client.getToken(code);

  if (!tokens.refresh_token) {
    throw new Error('No refresh token received. Please revoke access and try again.');
  }

  return {
    refreshToken: tokens.refresh_token,
    accessToken: tokens.access_token || '',
  };
}

export async function testDriveConnection(credentials: OAuthCredentials, folderId: string): Promise<{ success: boolean; email: string }> {
  const drive = createDriveClient(credentials);

  // Try to access the folder
  await drive.files.get({
    fileId: folderId,
    fields: 'id,name',
    supportsAllDrives: true,
  });

  // Get user email from the authenticated account
  const about = await drive.about.get({ fields: 'user' });
  const email = about.data.user?.emailAddress || 'unknown';

  return { success: true, email };
}

export async function uploadBackup(
  credentials: OAuthCredentials,
  folderId: string,
  fileName: string,
  buffer: Buffer
): Promise<{ fileId: string; name: string }> {
  const drive = createDriveClient(credentials);

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

export async function listBackups(credentials: OAuthCredentials, folderId: string): Promise<DriveBackupFile[]> {
  const drive = createDriveClient(credentials);

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

export async function downloadBackup(credentials: OAuthCredentials, fileId: string): Promise<Buffer> {
  const drive = createDriveClient(credentials);

  const response = await drive.files.get(
    { fileId, alt: 'media', supportsAllDrives: true },
    { responseType: 'arraybuffer' }
  );

  return Buffer.from(response.data as ArrayBuffer);
}

export async function deleteBackup(credentials: OAuthCredentials, fileId: string): Promise<void> {
  const drive = createDriveClient(credentials);
  await drive.files.delete({ fileId, supportsAllDrives: true });
}

export async function enforceRetention(
  credentials: OAuthCredentials,
  folderId: string,
  maxBackups: number
): Promise<number> {
  const backups = await listBackups(credentials, folderId);

  if (backups.length <= maxBackups) return 0;

  const toDelete = backups.slice(maxBackups);
  let deleted = 0;

  for (const backup of toDelete) {
    try {
      await deleteBackup(credentials, backup.id);
      deleted++;
    } catch (err) {
      console.error(`Failed to delete old backup ${backup.name}:`, err);
    }
  }

  return deleted;
}
