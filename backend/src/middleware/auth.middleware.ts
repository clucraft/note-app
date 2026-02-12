import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt.js';
import { hashApiKey } from '../utils/apikey.js';
import { db } from '../database/db.js';

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  // 1. Try Bearer JWT token first (existing flow)
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = verifyAccessToken(token);
      req.user = decoded;
      next();
      return;
    } catch (error) {
      // JWT invalid — fall through to try API key
    }
  }

  // 2. Try X-API-Key header
  const apiKey = req.headers['x-api-key'] as string | undefined;
  if (apiKey) {
    try {
      const keyHash = hashApiKey(apiKey);
      const row = db.prepare(`
        SELECT ak.id AS key_id, ak.user_id, u.role
        FROM api_keys ak
        JOIN users u ON u.id = ak.user_id
        WHERE ak.key_hash = ?
      `).get(keyHash) as { key_id: number; user_id: number; role: string } | undefined;

      if (row) {
        // Update last_used_at
        db.prepare('UPDATE api_keys SET last_used_at = datetime(\'now\') WHERE id = ?').run(row.key_id);
        req.user = { userId: row.user_id, role: row.role };
        next();
        return;
      }
    } catch (error) {
      // API key lookup failed — fall through
    }
  }

  res.status(401).json({ error: 'No valid token or API key provided' });
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
}
