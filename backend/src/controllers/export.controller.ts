import { Request, Response } from 'express';
import { exportNotes } from '../services/export.service.js';

export async function exportAllNotes(req: Request, res: Response) {
  try {
    const userId = req.user!.userId;
    const format = req.query.format as string;

    if (format !== 'markdown' && format !== 'html') {
      res.status(400).json({ error: 'Format must be "markdown" or "html"' });
      return;
    }

    const zipBuffer = await exportNotes(userId, format);

    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `Cache_Notes_Export_${timestamp}.zip`;

    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(zipBuffer.length),
    });

    res.send(zipBuffer);
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Failed to export notes' });
  }
}
