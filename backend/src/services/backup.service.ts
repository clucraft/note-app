import AdmZip from 'adm-zip';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { db, reinitializeDb } from '../database/db.js';

const uploadsDir = process.env.UPLOADS_PATH || '/data/uploads';
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../../data/notes.db');

export async function createBackupZip(): Promise<Buffer> {
  // Use SQLite's backup API for a safe, non-locking copy
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cache-notes-backup-'));
  const tempDbPath = path.join(tempDir, 'notes.db');

  try {
    await db.backup(tempDbPath);

    const zip = new AdmZip();

    // Add the database file
    zip.addLocalFile(tempDbPath, '', 'notes.db');

    // Add uploads directory if it exists
    if (fs.existsSync(uploadsDir)) {
      const files = fs.readdirSync(uploadsDir);
      for (const file of files) {
        const filePath = path.join(uploadsDir, file);
        if (fs.statSync(filePath).isFile()) {
          zip.addLocalFile(filePath, 'uploads');
        }
      }
    }

    // Add metadata
    const metadata = {
      timestamp: new Date().toISOString(),
      version: '1.0',
      app: 'cache-notes',
    };
    zip.addFile('metadata.json', Buffer.from(JSON.stringify(metadata, null, 2)));

    return zip.toBuffer();
  } finally {
    // Clean up temp files
    try {
      if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath);
      if (fs.existsSync(tempDir)) fs.rmdirSync(tempDir);
    } catch {
      // ignore cleanup errors
    }
  }
}

export async function restoreFromZip(buffer: Buffer): Promise<void> {
  const zip = new AdmZip(buffer);
  const entries = zip.getEntries();

  // Validate ZIP contents
  const hasDb = entries.some((e) => e.entryName === 'notes.db');
  const hasMetadata = entries.some((e) => e.entryName === 'metadata.json');

  if (!hasDb) {
    throw new Error('Invalid backup: missing notes.db');
  }

  if (!hasMetadata) {
    throw new Error('Invalid backup: missing metadata.json');
  }

  // Validate metadata
  const metadataEntry = zip.getEntry('metadata.json');
  if (metadataEntry) {
    const metadata = JSON.parse(metadataEntry.getData().toString('utf8'));
    if (metadata.app !== 'cache-notes') {
      throw new Error('Invalid backup: not a Cache Notes backup');
    }
  }

  // Extract database to temp, then swap
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cache-notes-restore-'));
  const tempDbPath = path.join(tempDir, 'notes.db');

  try {
    // Extract database to temp location
    const dbEntry = zip.getEntry('notes.db')!;
    fs.writeFileSync(tempDbPath, dbEntry.getData());

    // Close current DB and overwrite
    db.close();
    fs.copyFileSync(tempDbPath, dbPath);

    // Extract uploads
    if (fs.existsSync(uploadsDir)) {
      // Clear existing uploads
      const existing = fs.readdirSync(uploadsDir);
      for (const file of existing) {
        fs.unlinkSync(path.join(uploadsDir, file));
      }
    } else {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    for (const entry of entries) {
      if (entry.entryName.startsWith('uploads/') && !entry.isDirectory) {
        const fileName = path.basename(entry.entryName);
        fs.writeFileSync(path.join(uploadsDir, fileName), entry.getData());
      }
    }

    // Reinitialize database connection
    reinitializeDb();
  } finally {
    // Clean up temp files
    try {
      if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath);
      if (fs.existsSync(tempDir)) fs.rmdirSync(tempDir);
    } catch {
      // ignore cleanup errors
    }
  }
}
