import { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { z } from 'zod';
import { processDocmostImport } from '../services/import.service.js';

// Ensure temp directory exists
const tempDir = process.env.TEMP_PATH || '/tmp/import';
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Configure multer storage for temp files
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, tempDir);
  },
  filename: (_req, file, cb) => {
    const uniqueId = crypto.randomBytes(16).toString('hex');
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueId}${ext}`);
  }
});

// File filter - allow content files and attachments
const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExts = [
    // Content files
    '.md', '.html', '.htm',
    // Archive
    '.zip',
    // Images
    '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico',
    // Videos
    '.mp4', '.webm', '.ogg', '.mov',
    // Documents
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
    // Audio
    '.mp3', '.wav', '.flac',
    // Archives
    '.tar', '.gz', '.rar'
  ];

  if (allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${ext} is not allowed`));
  }
};

// Configure multer for import
export const importUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max per file
    files: 500 // Max 500 files
  }
});

// Validation schema
const importOptionsSchema = z.object({
  parentId: z.string().optional().transform(val => {
    if (!val || val === 'null' || val === '') return null;
    const num = parseInt(val, 10);
    return isNaN(num) ? null : num;
  }),
  preserveStructure: z.string().optional().transform(val => val !== 'false')
});

/**
 * Handle Docmost import
 */
export async function importDocmost(req: Request, res: Response) {
  const uploadedFiles: string[] = [];

  try {
    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      res.status(400).json({ error: 'No files uploaded' });
      return;
    }

    // Track uploaded files for cleanup
    uploadedFiles.push(...(req.files as Express.Multer.File[]).map(f => f.path));

    // Parse options
    const optionsResult = importOptionsSchema.safeParse(req.body);
    if (!optionsResult.success) {
      res.status(400).json({ error: 'Invalid options', details: optionsResult.error.errors });
      return;
    }

    const { parentId, preserveStructure } = optionsResult.data;
    const userId = req.user!.userId;

    // If parentId specified, verify it belongs to user
    if (parentId !== null) {
      const { db } = await import('../database/db.js');
      const parent = db.prepare('SELECT id FROM notes WHERE id = ? AND user_id = ?')
        .get(parentId, userId);
      if (!parent) {
        res.status(400).json({ error: 'Parent note not found' });
        return;
      }
    }

    // Process the import
    const result = await processDocmostImport(
      req.files as Express.Multer.File[],
      {
        userId,
        parentId,
        preserveStructure
      }
    );

    res.json(result);
  } catch (error: any) {
    console.error('Import error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to import files',
      imported: { notes: 0, attachments: 0 },
      errors: [{ file: 'general', error: error.message }],
      rootNoteIds: []
    });
  } finally {
    // Clean up temp files
    for (const filePath of uploadedFiles) {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (cleanupError) {
        console.error('Failed to clean up temp file:', filePath, cleanupError);
      }
    }
  }
}
